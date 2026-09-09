import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  assertDangerousSendAllowed,
  DangerousSendBlockedError,
  DEFAULT_HARVEST_USER_AGENT,
  HarvestConfigError,
  readHarvestEnv,
} from "../src/env.js";
import {
  abortableSleep,
  abortError,
  bindRequestSignal,
  DEFAULT_TIMEOUT_MS,
  errorToolResult,
  fetchWithTimeout,
  HarvestApiError,
  HarvestClient,
  harvestErrorMessage,
  harvestStatusHint,
  parseRetryAfterMs,
} from "../src/harvest-client.js";
import { PACKAGE_VERSION } from "../src/version.js";
import { createMockClient } from "./helpers.js";

describe("HarvestClient", () => {
  it("sends Bearer, Harvest-Account-Id, User-Agent, and Accept headers", async () => {
    const { client, requests } = createMockClient({ responseBody: { id: 1 } });
    await client.request({ method: "GET", path: "/invoices/9" });

    assert.equal(requests.length, 1);
    assert.equal(requests[0]?.headers.authorization, "Bearer test-token");
    assert.equal(requests[0]?.headers["harvest-account-id"], "123456");
    assert.equal(requests[0]?.headers["user-agent"], "harvest-rest-tests (test@example.com)");
    assert.equal(requests[0]?.headers.accept, "application/json");
    assert.equal(requests[0]?.headers["content-type"], undefined);
    assert.equal(requests[0]?.url, "https://api.harvestapp.com/v2/invoices/9");
  });

  it("serializes JSON bodies and query params", async () => {
    const { client, requests } = createMockClient({ responseBody: { ok: true } });
    await client.request({
      method: "POST",
      path: "/invoices/1/payments",
      query: { page: 2, unused: undefined },
      body: { amount: 10, notes: "keep" },
    });

    assert.equal(requests[0]?.url, "https://api.harvestapp.com/v2/invoices/1/payments?page=2");
    assert.equal(requests[0]?.headers["content-type"], "application/json");
    assert.deepEqual(requests[0]?.bodyJson, { amount: 10, notes: "keep" });
  });

  it("returns a status envelope for empty success bodies", async () => {
    const { client } = createMockClient({ status: 200, responseText: "" });
    const result = await client.request({ method: "DELETE", path: "/invoices/1" });
    assert.deepEqual(result, { ok: true, status: 200 });
  });

  it("rejects an empty User-Agent before calling Harvest", () => {
    assert.throws(
      () =>
        createMockClient({
          userAgent: "   ",
          responseBody: { id: 1 },
        }),
      (error: unknown) => error instanceof HarvestConfigError,
    );
  });

  it("retries a 429 using Retry-After seconds then succeeds", async () => {
    const { client, requests, sleeps } = createMockClient({
      responses: [
        { status: 429, responseBody: { message: "Slow down" }, responseHeaders: { "Retry-After": "2" } },
        { status: 200, responseBody: { id: 7 } },
      ],
    });

    const result = await client.request<{ id: number }>({ method: "GET", path: "/users/me" });
    assert.deepEqual(result, { id: 7 });
    assert.equal(requests.length, 2);
    assert.deepEqual(sleeps, [2000]);
    assert.equal(requests[0]?.headers["user-agent"], "harvest-rest-tests (test@example.com)");
    assert.equal(requests[1]?.headers.authorization, "Bearer test-token");
  });

  it("retries a 429 using HTTP-date Retry-After", async () => {
    const when = new Date(Date.now() + 1500).toUTCString();
    const { client, sleeps } = createMockClient({
      responses: [
        { status: 429, responseText: "", responseHeaders: { "Retry-After": when } },
        { status: 200, responseBody: { ok: true } },
      ],
    });

    await client.request({ method: "GET", path: "/company" });
    assert.equal(sleeps.length, 1);
    assert.ok((sleeps[0] ?? 0) <= 1500 + 50);
    assert.ok((sleeps[0] ?? 0) >= 0);
  });

  it("does not sleep when Retry-After exceeds the cap; surfaces 429 with seconds", async () => {
    const { client, requests, sleeps } = createMockClient({
      maxRetryAfterMs: 5_000,
      responses: [{ status: 429, responseBody: { error: "throttled" }, responseHeaders: { "Retry-After": "900" } }],
    });

    await assert.rejects(
      () => client.request({ method: "GET", path: "/reports/uninvoiced" }),
      (error: unknown) => {
        assert.ok(error instanceof HarvestApiError);
        assert.equal(error.status, 429);
        assert.equal(error.retryAfterSeconds, 900);
        assert.match(error.message, /Retry-After: 900s/);
        assert.match(error.message, /100 requests \/ 15 minutes/);
        assert.doesNotMatch(error.message, /test-token/);
        return true;
      },
    );
    assert.equal(requests.length, 1);
    assert.deepEqual(sleeps, []);
  });

  it("throws after exhausting 429 retries", async () => {
    const { client, requests, sleeps } = createMockClient({
      max429Retries: 1,
      responses: [
        { status: 429, responseBody: { message: "again" }, responseHeaders: { "Retry-After": "1" } },
        { status: 429, responseBody: { message: "still" }, responseHeaders: { "Retry-After": "1" } },
      ],
    });

    await assert.rejects(
      () => client.request({ method: "POST", path: "/invoices", body: { client_id: 1 } }),
      (error: unknown) => {
        assert.ok(error instanceof HarvestApiError);
        assert.equal(error.status, 429);
        assert.match(error.message, /still/);
        return true;
      },
    );
    assert.equal(requests.length, 2);
    assert.deepEqual(sleeps, [1000]);
  });

  it("uses the default wait when 429 omits Retry-After", async () => {
    const { client, sleeps } = createMockClient({
      defaultRetryAfterMs: 250,
      responses: [
        { status: 429, responseText: "throttled" },
        { status: 200, responseBody: { ok: true } },
      ],
    });

    await client.request({ method: "GET", path: "/clients" });
    assert.deepEqual(sleeps, [250]);
  });

  it("does not invent retryAfterSeconds when 429 omits Retry-After", async () => {
    const { client, sleeps } = createMockClient({
      max429Retries: 0,
      defaultRetryAfterMs: 250,
      responses: [{ status: 429, responseText: "throttled" }],
    });

    await assert.rejects(
      () => client.request({ method: "GET", path: "/clients" }),
      (error: unknown) => {
        assert.ok(error instanceof HarvestApiError);
        assert.equal(error.status, 429);
        assert.equal(error.retryAfterSeconds, undefined);
        assert.doesNotMatch(error.message, /Retry-After:/);
        const result = errorToolResult(error);
        const parsed = JSON.parse(result.content[0]?.text ?? "{}") as { retry_after_seconds?: number };
        assert.equal(parsed.retry_after_seconds, undefined);
        return true;
      },
    );
    assert.deepEqual(sleeps, []);
  });

  it("defaults timeoutMs to 30s and honors a caller override", async () => {
    assert.equal(DEFAULT_TIMEOUT_MS, 30_000);

    let seenSignal: AbortSignal | undefined;
    const fetchImpl: typeof fetch = async (_input, init) => {
      seenSignal = init?.signal ?? undefined;
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(abortError());
        });
      });
    };

    const client = new HarvestClient({
      accessToken: "test-token",
      accountId: "1",
      userAgent: "harvest-rest-tests (test@example.com)",
      fetchImpl,
      timeoutMs: 20,
    });

    await assert.rejects(() => client.request({ method: "GET", path: "/invoices/1" }), /timed out after 20ms/);
    assert.equal(seenSignal?.aborted, true);
  });

  it("skips AbortController when timeoutMs is 0 and no caller signal", async () => {
    let seenSignal: AbortSignal | undefined;
    const fetchImpl: typeof fetch = async (_input, init) => {
      seenSignal = init?.signal ?? undefined;
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };
    const client = new HarvestClient({
      accessToken: "test-token",
      accountId: "1",
      userAgent: "harvest-rest-tests (test@example.com)",
      fetchImpl,
      timeoutMs: 0,
    });
    await client.request({ method: "GET", path: "/company" });
    assert.equal(seenSignal, undefined);
  });

  it("combines MCP AbortSignal with the per-attempt timeout", async () => {
    const controller = new AbortController();
    let seenSignal: AbortSignal | undefined;
    const fetchImpl: typeof fetch = async (_input, init) => {
      seenSignal = init?.signal ?? undefined;
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(abortError());
        });
      });
    };
    const client = new HarvestClient({
      accessToken: "test-token",
      accountId: "1",
      userAgent: "harvest-rest-tests (test@example.com)",
      fetchImpl,
      timeoutMs: 5_000,
    });
    const pending = client.request({ method: "GET", path: "/company", signal: controller.signal });
    controller.abort();
    await assert.rejects(() => pending, (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.equal(error.name, "AbortError");
      return true;
    });
    assert.equal(seenSignal?.aborted, true);
  });

  it("aborts Retry-After sleep when the request signal aborts", async () => {
    let sleepStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      sleepStarted = resolve;
    });
    const controller = new AbortController();
    const fetchImpl: typeof fetch = async () =>
      new Response("throttled", {
        status: 429,
        headers: { "Retry-After": "30" },
      });
    const client = new HarvestClient({
      accessToken: "test-token",
      accountId: "1",
      userAgent: "harvest-rest-tests (test@example.com)",
      fetchImpl,
      timeoutMs: 0,
      maxRetryAfterMs: 60_000,
      sleepImpl: async (ms, signal) => {
        sleepStarted();
        await abortableSleep(ms, signal);
      },
    });
    const pending = client.request({ method: "GET", path: "/users/me", signal: controller.signal });
    await started;
    controller.abort();
    await assert.rejects(() => pending, (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.equal(error.name, "AbortError");
      return true;
    });
  });

  it("keeps fetchWithTimeout armed until response.text() completes", async () => {
    const fetchImpl: typeof fetch = async (_input, init) => {
      return {
        status: 200,
        ok: true,
        headers: new Headers({ "Content-Type": "application/json" }),
        text: () =>
          new Promise<string>((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => {
              reject(abortError());
            });
          }),
      } as Response;
    };

    await assert.rejects(
      () => fetchWithTimeout(fetchImpl, "https://api.harvestapp.com/v2/company", {}, 20),
      /timed out after 20ms/,
    );
  });

  it("bindRequestSignal forwards the MCP signal onto request()", async () => {
    const controller = new AbortController();
    const fetchImpl: typeof fetch = async (_input, init) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(abortError());
        });
      });
    };
    const bound = bindRequestSignal(
      new HarvestClient({
        accessToken: "test-token",
        accountId: "1",
        userAgent: "harvest-rest-tests (test@example.com)",
        fetchImpl,
        timeoutMs: 0,
      }),
      controller.signal,
    );
    const pending = bound.request({ method: "GET", path: "/company" });
    controller.abort();
    await assert.rejects(() => pending, (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.equal(error.name, "AbortError");
      return true;
    });
  });

  it("surfaces Harvest 4xx/5xx without leaking the token", async () => {
    const cases: Array<{ status: number; body: unknown; expect: RegExp }> = [
      { status: 400, body: { message: "User-Agent header is required" }, expect: /User-Agent/ },
      { status: 403, body: { message: "Forbidden" }, expect: /Forbidden/ },
      { status: 404, body: { error: "Not found" }, expect: /Not Found/ },
      { status: 422, body: { errors: { per_page: ["Invalid per_page parameter"] } }, expect: /Invalid per_page/ },
      { status: 500, body: { message: "boom" }, expect: /server error/ },
    ];

    for (const item of cases) {
      const { client, requests } = createMockClient({
        status: item.status,
        responseBody: item.body,
      });

      await assert.rejects(
        () => client.request({ method: "DELETE", path: "/invoices/1" }),
        (error: unknown) => {
          assert.ok(error instanceof HarvestApiError);
          assert.equal(error.status, item.status);
          assert.match(error.message, item.expect);
          assert.match(error.message, new RegExp(`Harvest API ${item.status}`));
          assert.doesNotMatch(error.message, /test-token/);
          return true;
        },
      );
      assert.equal(requests[0]?.headers.authorization, "Bearer test-token");
    }
  });
});

describe("Retry-After parsing", () => {
  it("parses delta-seconds and HTTP-date", () => {
    assert.equal(parseRetryAfterMs("12"), 12_000);
    assert.equal(parseRetryAfterMs(""), undefined);
    assert.equal(parseRetryAfterMs(null), undefined);
    const now = Date.parse("Wed, 08 Sep 2026 17:00:00 GMT");
    assert.equal(parseRetryAfterMs("Wed, 08 Sep 2026 17:00:05 GMT", now), 5_000);
    assert.equal(parseRetryAfterMs("not-a-date"), undefined);
  });
});

describe("error mapping", () => {
  it("maps documented Harvest statuses", () => {
    assert.match(harvestStatusHint(400), /User-Agent/);
    assert.match(harvestStatusHint(403), /Forbidden/);
    assert.match(harvestStatusHint(404), /Not Found/);
    assert.match(harvestStatusHint(422), /Unprocessable/);
    assert.match(harvestStatusHint(429), /100 requests \/ 15 seconds/);
    assert.match(harvestStatusHint(500), /support@getharvest.com/);
    assert.equal(harvestStatusHint(418), "");
  });

  it("includes 422 errors JSON and optional Retry-After", () => {
    const message = harvestErrorMessage(422, { errors: { name: ["required"] } }, "", undefined);
    assert.match(message, /required/);
    const throttled = harvestErrorMessage(429, { message: "Slow down" }, "", 15);
    assert.match(throttled, /Retry-After: 15s/);
    assert.match(throttled, /Slow down/);
  });

  it("JSON-surfaces HarvestApiError to tools without the token", () => {
    const error = new HarvestApiError(429, "Harvest API 429 Throttled Retry-After: 3s", { message: "throttled" }, {
      retryAfterSeconds: 3,
    });
    const result = errorToolResult(error);
    assert.equal(result.isError, true);
    const parsed = JSON.parse(result.content[0]?.text ?? "{}") as {
      status: number;
      retry_after_seconds: number;
      message: string;
    };
    assert.equal(parsed.status, 429);
    assert.equal(parsed.retry_after_seconds, 3);
    assert.doesNotMatch(result.content[0]?.text ?? "", /Bearer/);
  });
});

describe("readHarvestEnv", () => {
  it("requires token and account id", () => {
    assert.throws(
      () => readHarvestEnv({}),
      (error: unknown) => error instanceof HarvestConfigError,
    );
  });

  it("defaults User-Agent from root package.json semver (Mike-locked author contact)", () => {
    const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
    const pluginPkg = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8")) as {
      name: string;
      version: string;
    };
    const pluginManifest = JSON.parse(readFileSync(join(repoRoot, "plugin.json"), "utf8")) as { version: string };
    const restPkg = JSON.parse(readFileSync(join(repoRoot, "servers/harvest-rest/package.json"), "utf8")) as {
      version: string;
    };

    assert.equal(pluginPkg.name, "m2avc-harvest-mcp");
    assert.match(pluginPkg.version, /^\d+\.\d+\.\d+/);
    assert.equal(pluginPkg.version, pluginManifest.version);
    assert.equal(pluginPkg.version, restPkg.version);
    assert.equal(PACKAGE_VERSION, pluginPkg.version);

    const env = readHarvestEnv({
      HARVEST_ACCESS_TOKEN: " tok ",
      HARVEST_ACCOUNT_ID: " 99 ",
    });
    assert.equal(env.accessToken, "tok");
    assert.equal(env.accountId, "99");
    assert.equal(env.userAgent, DEFAULT_HARVEST_USER_AGENT);
    assert.equal(env.userAgent, `m2avc-harvest-mcp/${pluginPkg.version} (mn@m2avc.com)`);
    assert.doesNotMatch(env.userAgent, /support@m2avc.com/);
    assert.equal(env.apiBase, "https://api.harvestapp.com/v2");
  });

  it("honors HARVEST_USER_AGENT and does not use end-user Harvest email as UA", () => {
    const env = readHarvestEnv({
      HARVEST_ACCESS_TOKEN: "tok",
      HARVEST_ACCOUNT_ID: "99",
      HARVEST_USER_AGENT: "harvest-cos-smoke (you@example.com)",
      HARVEST_USER_EMAIL: "customer@example.com",
      HARVEST_COMPANY: "Acme Roofing",
    });
    assert.equal(env.userAgent, "harvest-cos-smoke (you@example.com)");
    assert.doesNotMatch(env.userAgent, /customer@example.com/);
    assert.doesNotMatch(env.userAgent, /Acme Roofing/);
  });

  it("ignores blank HARVEST_USER_AGENT and falls back to the marketplace default", () => {
    const env = readHarvestEnv({
      HARVEST_ACCESS_TOKEN: "tok",
      HARVEST_ACCOUNT_ID: "99",
      HARVEST_USER_AGENT: "   ",
    });
    assert.equal(env.userAgent, DEFAULT_HARVEST_USER_AGENT);
  });

  it("keeps DANGEROUS_SEND off unless exactly 1", () => {
    assert.throws(() => assertDangerousSendAllowed("test", {}), (error: unknown) => {
      return error instanceof DangerousSendBlockedError;
    });
    assert.throws(() => assertDangerousSendAllowed("test", { DANGEROUS_SEND: "true" }), (error: unknown) => {
      return error instanceof DangerousSendBlockedError;
    });
    assert.doesNotThrow(() => assertDangerousSendAllowed("test", { DANGEROUS_SEND: "1" }));
  });
});
