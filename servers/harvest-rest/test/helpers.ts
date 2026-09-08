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

export function createMockClient(options?: {
  status?: number;
  responseBody?: unknown;
  responseText?: string;
}): { client: HarvestClient; requests: RecordedRequest[] } {
  const requests: RecordedRequest[] = [];
  const status = options?.status ?? 200;
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

    const text =
      options?.responseText !== undefined
        ? options.responseText
        : options?.responseBody === undefined
          ? ""
          : JSON.stringify(options.responseBody);

    return new Response(text, {
      status,
      headers: { "Content-Type": "application/json" },
    });
  };

  const client = new HarvestClient({
    accessToken: "test-token",
    accountId: "123456",
    userAgent: "harvest-rest-tests (test@example.com)",
    apiBase: "https://api.harvestapp.com/v2",
    fetchImpl,
  });

  return { client, requests };
}
