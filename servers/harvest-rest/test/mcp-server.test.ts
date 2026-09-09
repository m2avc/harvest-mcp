import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { HarvestClient } from "../src/harvest-client.js";
import { registerHarvestRestTools, REST_TOOL_NAMES } from "../src/register-tools.js";
import { VERBATIM_PAYMENT_NOTES } from "./helpers.js";

async function connectHarvestRest(fetchImpl: typeof fetch): Promise<{
  mcpClient: Client;
  server: McpServer;
}> {
  const harvestClient = new HarvestClient({
    accessToken: "test-token",
    accountId: "1",
    userAgent: "harvest-rest-tests (test@example.com)",
    fetchImpl,
  });

  const server = new McpServer({ name: "harvest-rest", version: "0.2.0" });
  registerHarvestRestTools(server, harvestClient);

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const mcpClient = new Client({ name: "test-client", version: "0.0.0" });
  await Promise.all([server.connect(serverTransport), mcpClient.connect(clientTransport)]);
  return { mcpClient, server };
}

function recordingFetch(recorded: Array<{ url: string; bodyJson: unknown }>): typeof fetch {
  return async (input, init) => {
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
}

describe("harvest-rest MCP server", () => {
  it("advertises P0 tools including a plain object schema for create_invoice_payment", async () => {
    const { mcpClient, server } = await connectHarvestRest(recordingFetch([]));
    try {
      const listed = await mcpClient.listTools();
      const names = listed.tools.map((tool) => tool.name).sort();
      assert.deepEqual(names, [...REST_TOOL_NAMES].sort());

      const paymentTool = listed.tools.find((tool) => tool.name === "create_invoice_payment");
      assert.equal(paymentTool?.inputSchema?.type, "object");
      assert.ok(paymentTool?.inputSchema?.properties && "amount" in paymentTool.inputSchema.properties);
      assert.ok(paymentTool?.inputSchema?.properties && "invoice_id" in paymentTool.inputSchema.properties);
    } finally {
      await mcpClient.close();
      await server.close();
    }
  });

  it("blocks create_invoice_message send when DANGEROUS_SEND is unset", async () => {
    const { mcpClient, server } = await connectHarvestRest(recordingFetch([]));
    try {
      const blockedSend = await mcpClient.callTool({
        name: "create_invoice_message",
        arguments: { invoice_id: 10, event_type: "send" },
      });
      assert.equal(blockedSend.isError, true);
      const blockedText = JSON.stringify(blockedSend.content);
      assert.match(blockedText, /DANGEROUS_SEND/);
    } finally {
      await mcpClient.close();
      await server.close();
    }
  });

  it("creates a payment without rewriting notes", async () => {
    const recorded: Array<{ url: string; bodyJson: unknown }> = [];
    const { mcpClient, server } = await connectHarvestRest(recordingFetch(recorded));
    try {
      const payment = await mcpClient.callTool({
        name: "create_invoice_payment",
        arguments: { invoice_id: 10, amount: 1.5, notes: VERBATIM_PAYMENT_NOTES },
      });
      assert.equal(payment.isError, undefined);

      const paymentRequest = recorded.find((item) => item.url.endsWith("/payments"));
      assert.equal((paymentRequest?.bodyJson as { notes: string }).notes, VERBATIM_PAYMENT_NOTES);
      assert.equal((paymentRequest?.bodyJson as { send_thank_you: boolean }).send_thank_you, false);
    } finally {
      await mcpClient.close();
      await server.close();
    }
  });
});
