import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { listContacts } from "../src/tools/contacts.js";
import { REST_TOOL_NAMES } from "../src/register-tools.js";
import { createMockClient } from "./helpers.js";

describe("list_contacts", () => {
  it("lists contacts filtered by client_id for invoice recipients", async () => {
    const { client, requests } = createMockClient({
      responseBody: { contacts: [{ id: 1, email: "a@example.com", invoice_recipient_status: "recipient" }] },
    });
    await listContacts(client, { client_id: 5735776 });
    assert.equal(requests[0]?.method, "GET");
    assert.equal(requests[0]?.url, "https://api.harvestapp.com/v2/contacts?client_id=5735776");
  });
});

describe("REST tool catalog", () => {
  it("exports the P0 invoice REST tool names", () => {
    assert.deepEqual([...REST_TOOL_NAMES], [
      "update_invoice",
      "delete_invoice",
      "list_invoice_messages",
      "create_invoice_message",
      "preview_invoice_message",
      "delete_invoice_message",
      "list_invoice_payments",
      "create_invoice_payment",
      "delete_invoice_payment",
      "list_contacts",
    ]);
  });
});
