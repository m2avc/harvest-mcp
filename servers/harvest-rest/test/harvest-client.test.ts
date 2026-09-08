import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assertDangerousSendAllowed,
  DangerousSendBlockedError,
  DEFAULT_HARVEST_USER_AGENT,
  HarvestConfigError,
  readHarvestEnv,
} from "../src/env.js";
import {
  errorToolResult,
  HarvestApiError,
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

  it("defaults User-Agent to marketplace app name + version + author email", () => {
    const env = readHarvestEnv({
      HARVEST_ACCESS_TOKEN: " tok ",
      HARVEST_ACCOUNT_ID: " 99 ",
    });
    assert.equal(env.accessToken, "tok");
    assert.equal(env.accountId, "99");
    assert.equal(env.userAgent, DEFAULT_HARVEST_USER_AGENT);
    assert.equal(env.userAgent, `m2avc-harvest-mcp/${PACKAGE_VERSION} (mn@m2avc.com)`);
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
