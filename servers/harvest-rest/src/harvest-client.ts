import { HarvestConfigError } from "./env.js";

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
  /** Extra 429 attempts after the first response. Default 2 (3 tries total). */
  max429Retries?: number;
  /** Do not sleep longer than this for Retry-After; throw instead. Default 30s. */
  maxRetryAfterMs?: number;
  /** Used when Harvest omits Retry-After. Default 1s. */
  defaultRetryAfterMs?: number;
  sleepImpl?: (ms: number) => Promise<void>;
};

export type HarvestApiErrorExtras = {
  retryAfterSeconds?: number;
};

export const DEFAULT_MAX_429_RETRIES = 2;
export const DEFAULT_MAX_RETRY_AFTER_MS = 30_000;
export const DEFAULT_RETRY_AFTER_MS = 1_000;

export class HarvestApiError extends Error {
  readonly status: number;
  readonly body: unknown;
  readonly retryAfterSeconds?: number;

  constructor(status: number, message: string, body: unknown, extras?: HarvestApiErrorExtras) {
    super(message);
    this.name = "HarvestApiError";
    this.status = status;
    this.body = body;
    this.retryAfterSeconds = extras?.retryAfterSeconds;
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

/**
 * Harvest sends Retry-After as delta-seconds (RFC 2616). HTTP-date is also accepted.
 * https://help.getharvest.com/api-v2/introduction/overview/general/
 */
export function parseRetryAfterMs(header: string | null | undefined, nowMs: number = Date.now()): number | undefined {
  if (header === null || header === undefined) {
    return undefined;
  }
  const trimmed = header.trim();
  if (trimmed.length === 0) {
    return undefined;
  }
  if (/^\d+$/.test(trimmed)) {
    return Number(trimmed) * 1000;
  }
  const dateMs = Date.parse(trimmed);
  if (Number.isNaN(dateMs)) {
    return undefined;
  }
  return Math.max(0, dateMs - nowMs);
}

export function harvestStatusHint(status: number): string {
  switch (status) {
    case 400:
      return "Bad Request. Harvest requires User-Agent = integration app name + author contact link or email (https://help.getharvest.com/api-v2/introduction/overview/general/). GET parameters belong in the query string; POST/PATCH JSON bodies require Content-Type: application/json.";
    case 403:
      return "Forbidden. The object was found but this token's user is not allowed to perform the request.";
    case 404:
      return "Not Found. The object does not exist or is not visible to this token.";
    case 422:
      return "Unprocessable Entity. Harvest rejected the request parameters.";
    case 429:
      return "Throttled. General API limit is 100 requests / 15 seconds; Reports API is 100 requests / 15 minutes (https://help.getharvest.com/api-v2/introduction/overview/general/).";
    case 500:
      return "Harvest server error. Contact support@getharvest.com if it persists.";
    default:
      return "";
  }
}

function harvestDetail(parsed: unknown, rawText: string): string {
  if (parsed && typeof parsed === "object") {
    const record = parsed as Record<string, unknown>;
    if (typeof record.message === "string" && record.message.length > 0) {
      return record.message;
    }
    if (typeof record.error === "string" && record.error.length > 0) {
      return record.error;
    }
    if (record.errors !== undefined) {
      return JSON.stringify(record.errors);
    }
  }
  if (rawText.length > 0) {
    return rawText;
  }
  return "";
}

export function harvestErrorMessage(
  status: number,
  parsed: unknown,
  rawText: string,
  retryAfterSeconds?: number,
): string {
  const hint = harvestStatusHint(status);
  const detail = harvestDetail(parsed, rawText);
  const parts = [`Harvest API ${status}`];
  if (hint.length > 0) {
    parts.push(hint);
  }
  if (detail.length > 0 && !hint.includes(detail)) {
    parts.push(detail);
  }
  if (retryAfterSeconds !== undefined) {
    parts.push(`Retry-After: ${retryAfterSeconds}s`);
  }
  return parts.join(" ");
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export class HarvestClient {
  private readonly accessToken: string;
  private readonly accountId: string;
  private readonly userAgent: string;
  private readonly apiBase: string;
  private readonly fetchImpl: typeof fetch;
  private readonly max429Retries: number;
  private readonly maxRetryAfterMs: number;
  private readonly defaultRetryAfterMs: number;
  private readonly sleepImpl: (ms: number) => Promise<void>;

  constructor(options: HarvestClientOptions) {
    if (options.userAgent.trim().length === 0) {
      throw new HarvestConfigError(
        "Harvest API v2 requires a User-Agent header with the integration application name and a contact link or email (https://help.getharvest.com/api-v2/introduction/overview/general/). Empty User-Agent returns 400.",
      );
    }
    this.accessToken = options.accessToken;
    this.accountId = options.accountId;
    this.userAgent = options.userAgent;
    this.apiBase = options.apiBase ?? "https://api.harvestapp.com/v2";
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.max429Retries = options.max429Retries ?? DEFAULT_MAX_429_RETRIES;
    this.maxRetryAfterMs = options.maxRetryAfterMs ?? DEFAULT_MAX_RETRY_AFTER_MS;
    this.defaultRetryAfterMs = options.defaultRetryAfterMs ?? DEFAULT_RETRY_AFTER_MS;
    this.sleepImpl = options.sleepImpl ?? defaultSleep;
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

    const maxAttempts = this.max429Retries + 1;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const response = await this.fetchImpl(url, {
        method: init.method,
        headers,
        body: serializedBody,
      });

      const rawText = await response.text();
      const parsed = parseJsonBody(rawText);
      const retryAfterMs = parseRetryAfterMs(response.headers.get("Retry-After")) ?? this.defaultRetryAfterMs;
      const retryAfterSeconds = Math.ceil(retryAfterMs / 1000);

      if (response.status === 429 && attempt < this.max429Retries && retryAfterMs <= this.maxRetryAfterMs) {
        await this.sleepImpl(retryAfterMs);
        continue;
      }

      if (!response.ok) {
        throw new HarvestApiError(
          response.status,
          harvestErrorMessage(
            response.status,
            parsed,
            rawText,
            response.status === 429 ? retryAfterSeconds : undefined,
          ),
          parsed ?? rawText,
          response.status === 429 ? { retryAfterSeconds } : undefined,
        );
      }

      if (rawText.length === 0) {
        return { ok: true, status: response.status } as T;
      }

      return parsed as T;
    }

    throw new HarvestApiError(429, harvestErrorMessage(429, undefined, "", undefined), undefined);
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
  if (error instanceof HarvestApiError) {
    const payload: Record<string, unknown> = {
      error: error.name,
      status: error.status,
      message: error.message,
    };
    if (error.retryAfterSeconds !== undefined) {
      payload.retry_after_seconds = error.retryAfterSeconds;
    }
    if (error.body !== undefined) {
      payload.body = error.body;
    }
    return {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      isError: true,
    };
  }
  const message = error instanceof Error ? error.message : String(error);
  return {
    content: [{ type: "text", text: message }],
    isError: true,
  };
}
