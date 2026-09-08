import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { HarvestClient } from "../src/harvest-client.js";
import { registerHarvestRestTools, REST_TOOL_NAMES } from "../src/register-tools.js";
import { VERBATIM_PAYMENT_NOTES } from "./helpers.js";

describe("harvest-rest MCP server", () => {
  it("advertises P0 tools and creates a payment without rewriting notes", async () => {
    const recorded: Array<{ url: string; bodyJson: unknown }> = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const bodyText = typeof init?.body === "string" ? init.body : undefined;
      recorded.push({
        url,
        bodyJson: bodyText === undefined ? undefined : JSON.parse(bodyText),
      });
      return new Response(JSON.stringify({ id: 99, notes: VERBATIM_PAYMENT_NOTES, event_type: "send" }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
    };

    const client = new HarvestClient({
      accessToken: "test-token",
      accountId: "1",
      userAgent: "harvest-rest-tests (test@example.com)",
      fetchImpl,
    });

    const server = new McpServer({ name: "harvest-rest", version: "0.2.0" });
    registerHarvestRestTools(server, client);

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const mcpClient = new Client({ name: "test-client", version: "0.0.0" });
    await Promise.all([server.connect(serverTransport), mcpClient.connect(clientTransport)]);

    const listed = await mcpClient.listTools();
    const names = listed.tools.map((tool) => tool.name).sort();
    assert.deepEqual(names, [...REST_TOOL_NAMES].sort());

    const send = await mcpClient.callTool({
      name: "create_invoice_message",
      arguments: { invoice_id: 10, event_type: "send" },
    });
    assert.equal(send.isError, undefined);

    const payment = await mcpClient.callTool({
      name: "create_invoice_payment",
      arguments: { invoice_id: 10, amount: 1.5, notes: VERBATIM_PAYMENT_NOTES },
    });
    assert.equal(payment.isError, undefined);

    const paymentRequest = recorded.find((item) => item.url.endsWith("/payments"));
    assert.equal((paymentRequest?.bodyJson as { notes: string }).notes, VERBATIM_PAYMENT_NOTES);

    await mcpClient.close();
    await server.close();
  });
});
