import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { HarvestApiError } from "../src/harvest-client.js";
import { createMockClient } from "./helpers.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

function readRepo(rel: string): string {
  return readFileSync(join(repoRoot, rel), "utf8");
}

describe("marketplace security gate", () => {
  it("does not embed Harvest secrets in committed mcp.json or .env.example", () => {
    const mcp = JSON.parse(readRepo("mcp.json")) as { mcpServers?: Record<string, unknown> };
    const mcpText = JSON.stringify(mcp);
    assert.doesNotMatch(mcpText, /HARVEST_ACCESS_TOKEN/);
    assert.doesNotMatch(mcpText, /access_token/i);
    assert.doesNotMatch(mcpText, /HARVEST_ACCOUNT_ID/);
    assert.ok(mcp.mcpServers?.["harvest-rest"]);

    const envExample = readRepo("servers/harvest-rest/.env.example");
    assert.match(envExample, /^HARVEST_ACCESS_TOKEN=\s*$/m);
    assert.match(envExample, /^HARVEST_ACCOUNT_ID=\s*$/m);
    assert.doesNotMatch(envExample, /^DANGEROUS_SEND=1\s*$/m);
  });

  it("test fixtures do not contain live tokens or account secrets", () => {
    const helpers = readRepo("servers/harvest-rest/test/helpers.ts");
    assert.match(helpers, /test-token/);
    assert.doesNotMatch(helpers, /HARVEST_ACCESS_TOKEN\s*=\s*["'][^"']+["']/);
    assert.doesNotMatch(readRepo("servers/harvest-rest/test/harvest-client.test.ts"), /Bearer [A-Za-z0-9_-]{20,}/);
  });

  it("Harvest error surfaces never include the Bearer token", async () => {
    const { client } = createMockClient({
      status: 403,
      responseBody: { message: "Forbidden" },
    });
    await assert.rejects(
      () => client.request({ method: "GET", path: "/invoices/1" }),
      (error: unknown) => {
        assert.ok(error instanceof HarvestApiError);
        assert.doesNotMatch(error.message, /test-token/);
        assert.doesNotMatch(error.message, /Bearer /);
        return true;
      },
    );
  });
});
