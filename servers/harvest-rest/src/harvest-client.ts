export type HarvestRequestInit = {
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
};

export type HarvestClientOptions = {
  accessToken: string;
  accountId: string;
  userAgent: string;
  apiBase?: string;
  fetchImpl?: typeof fetch;
  /** Per-request timeout. Default 30s. Set `0` to disable. */
  timeoutMs?: number;
};

export const DEFAULT_TIMEOUT_MS = 30_000;

function isAbortError(error: unknown): boolean {
  return error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError");
}

/**
 * AbortController per request. Always clears the timer on settle so a
 * successful call cannot leak a 30s handle. Callers (including a 429 retry
 * loop) can wrap each attempt.
 */
export async function fetchWithTimeout(
  fetchImpl: typeof fetch,
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return fetchImpl(url, init);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    return await fetchImpl(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (isAbortError(error)) {
      throw new Error(`Harvest API request timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export class HarvestApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, message: string, body: unknown) {
    super(message);
    this.name = "HarvestApiError";
    this.status = status;
    this.body = body;
  }
}

function joinUrl(apiBase: string, path: string): string {
  const base = apiBase.endsWith("/") ? apiBase.slice(0, -1) : apiBase;
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${base}${suffix}`;
}

function appendQuery(url: string, query?: HarvestRequestInit["query"]): string {
  if (!query) {
    return url;
  }
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined) {
      continue;
    }
    params.set(key, String(value));
  }
  const encoded = params.toString();
  return encoded.length === 0 ? url : `${url}?${encoded}`;
}

function harvestErrorMessage(status: number, parsed: unknown, rawText: string): string {
  if (parsed && typeof parsed === "object") {
    const record = parsed as Record<string, unknown>;
    if (typeof record.message === "string" && record.message.length > 0) {
      return `Harvest API ${status}: ${record.message}`;
    }
    if (typeof record.error === "string" && record.error.length > 0) {
      return `Harvest API ${status}: ${record.error}`;
    }
    if (record.errors !== undefined) {
      return `Harvest API ${status}: ${JSON.stringify(record.errors)}`;
    }
  }
  if (rawText.length > 0) {
    return `Harvest API ${status}: ${rawText}`;
  }
  return `Harvest API ${status}`;
}

export class HarvestClient {
  private readonly accessToken: string;
  private readonly accountId: string;
  private readonly userAgent: string;
  private readonly apiBase: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(options: HarvestClientOptions) {
    this.accessToken = options.accessToken;
    this.accountId = options.accountId;
    this.userAgent = options.userAgent;
    this.apiBase = options.apiBase ?? "https://api.harvestapp.com/v2";
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  async request<T>(init: HarvestRequestInit): Promise<T> {
    const url = appendQuery(joinUrl(this.apiBase, init.path), init.query);
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.accessToken}`,
      "Harvest-Account-Id": this.accountId,
      "User-Agent": this.userAgent,
      Accept: "application/json",
    };

    let serializedBody: string | undefined;
    if (init.body !== undefined) {
      headers["Content-Type"] = "application/json";
      serializedBody = JSON.stringify(init.body);
    }

    const response = await fetchWithTimeout(
      this.fetchImpl,
      url,
      {
        method: init.method,
        headers,
        body: serializedBody,
      },
      this.timeoutMs,
    );

    const rawText = await response.text();
    const parsed = parseJsonBody(rawText);

    if (!response.ok) {
      throw new HarvestApiError(response.status, harvestErrorMessage(response.status, parsed, rawText), parsed ?? rawText);
    }

    if (rawText.length === 0) {
      return { ok: true, status: response.status } as T;
    }

    return parsed as T;
  }
}

export function parseJsonBody(rawText: string): unknown {
  if (rawText.length === 0) {
    return undefined;
  }
  try {
    return JSON.parse(rawText) as unknown;
  } catch {
    return rawText;
  }
}

export function jsonToolResult(data: unknown): { content: Array<{ type: "text"; text: string }> } {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
  };
}

export function errorToolResult(error: unknown): { content: Array<{ type: "text"; text: string }>; isError: true } {
  const message = error instanceof Error ? error.message : String(error);
  return {
    content: [{ type: "text", text: message }],
    isError: true,
  };
}
