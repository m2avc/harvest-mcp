import { HarvestClient } from "../src/harvest-client.js";

/** Exact notes fixture — must survive JSON serialize/parse unchanged. */
export const VERBATIM_PAYMENT_NOTES = [
  "  Paid via ACH — ref #A1",
  '\t"quoted" & <xml>',
  "line2\r\nline3  ",
  "🙂 café naïve",
].join("\n");

export type RecordedRequest = {
  url: string;
  method: string;
  headers: Record<string, string>;
  bodyText: string | undefined;
  bodyJson: unknown;
};

export type MockResponseSpec = {
  status?: number;
  responseBody?: unknown;
  responseText?: string;
  responseHeaders?: Record<string, string>;
};

export function createMockClient(options?: MockResponseSpec & {
  responses?: MockResponseSpec[];
  sleepImpl?: (ms: number) => Promise<void>;
  userAgent?: string;
  max429Retries?: number;
  maxRetryAfterMs?: number;
  defaultRetryAfterMs?: number;
}): { client: HarvestClient; requests: RecordedRequest[]; sleeps: number[] } {
  const requests: RecordedRequest[] = [];
  const sleeps: number[] = [];
  const queued = options?.responses === undefined ? undefined : [...options.responses];
  const fallbackStatus = options?.status ?? 200;

  const fetchImpl: typeof fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const headers = Object.fromEntries(new Headers(init?.headers).entries());
    const bodyText = typeof init?.body === "string" ? init.body : undefined;
    requests.push({
      url,
      method: init?.method ?? "GET",
      headers,
      bodyText,
      bodyJson: bodyText === undefined ? undefined : JSON.parse(bodyText),
    });

    const spec = queued?.shift() ?? {
      status: fallbackStatus,
      responseBody: options?.responseBody,
      responseText: options?.responseText,
      responseHeaders: options?.responseHeaders,
    };

    const text =
      spec.responseText !== undefined
        ? spec.responseText
        : spec.responseBody === undefined
          ? ""
          : JSON.stringify(spec.responseBody);

    return new Response(text, {
      status: spec.status ?? 200,
      headers: { "Content-Type": "application/json", ...spec.responseHeaders },
    });
  };

  const client = new HarvestClient({
    accessToken: "test-token",
    accountId: "123456",
    userAgent: options?.userAgent ?? "harvest-rest-tests (test@example.com)",
    apiBase: "https://api.harvestapp.com/v2",
    fetchImpl,
    sleepImpl:
      options?.sleepImpl ??
      (async (ms: number) => {
        sleeps.push(ms);
      }),
    max429Retries: options?.max429Retries,
    maxRetryAfterMs: options?.maxRetryAfterMs,
    defaultRetryAfterMs: options?.defaultRetryAfterMs,
  });

  return { client, requests, sleeps };
}
