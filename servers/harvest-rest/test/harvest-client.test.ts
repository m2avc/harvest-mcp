import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { HarvestApiError } from "../src/harvest-client.js";
import { HarvestConfigError, readHarvestEnv } from "../src/env.js";
import { createMockClient } from "./helpers.js";

describe("HarvestClient", () => {
  it("sends Bearer, Harvest-Account-Id, and User-Agent headers", async () => {
    const { client, requests } = createMockClient({ responseBody: { id: 1 } });
    await client.request({ method: "GET", path: "/invoices/9" });

    assert.equal(requests.length, 1);
    assert.equal(requests[0]?.headers.authorization, "Bearer test-token");
    assert.equal(requests[0]?.headers["harvest-account-id"], "123456");
    assert.equal(requests[0]?.headers["user-agent"], "harvest-rest-tests (test@example.com)");
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

  it("surfaces Harvest error messages without leaking the token", async () => {
    const { client, requests } = createMockClient({
      status: 403,
      responseBody: { message: "Forbidden" },
    });

    await assert.rejects(
      () => client.request({ method: "DELETE", path: "/invoices/1" }),
      (error: unknown) => {
        assert.ok(error instanceof HarvestApiError);
        assert.equal(error.status, 403);
        assert.match(error.message, /Forbidden/);
        assert.doesNotMatch(error.message, /test-token/);
        return true;
      },
    );
    assert.equal(requests[0]?.headers.authorization, "Bearer test-token");
  });
});

describe("readHarvestEnv", () => {
  it("requires token and account id", () => {
    assert.throws(
      () => readHarvestEnv({}),
      (error: unknown) => error instanceof HarvestConfigError,
    );
  });

  it("defaults User-Agent and API base", () => {
    const env = readHarvestEnv({
      HARVEST_ACCESS_TOKEN: " tok ",
      HARVEST_ACCOUNT_ID: " 99 ",
    });
    assert.equal(env.accessToken, "tok");
    assert.equal(env.accountId, "99");
    assert.match(env.userAgent, /m2avc-harvest-mcp/);
    assert.equal(env.apiBase, "https://api.harvestapp.com/v2");
  });
});
