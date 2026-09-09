import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildUpdateInvoiceBody, deleteInvoice, updateInvoice, updateInvoiceInputSchema } from "../src/tools/invoices.js";
import { createMockClient } from "./helpers.js";

describe("update_invoice", () => {
  it("PATCHes header fields and line item create/update/_destroy semantics", async () => {
    const { client, requests } = createMockClient({
      responseBody: { id: 13150453, purchase_order: "2345" },
    });

    const input = updateInvoiceInputSchema.parse({
      invoice_id: "13150453",
      purchase_order: "2345",
      subject: "ABC Project Quote",
      payment_term: "net 30",
      payment_options: ["credit_card"],
      line_items: [
        { kind: "Service", description: "New line", unit_price: 1000 },
        { id: 53341928, description: "Updated line", unit_price: 5000 },
        { id: 53341927, _destroy: true },
      ],
    });

    const result = await updateInvoice(client, input);
    assert.deepEqual(result, { id: 13150453, purchase_order: "2345" });
    assert.equal(requests[0]?.method, "PATCH");
    assert.equal(requests[0]?.url, "https://api.harvestapp.com/v2/invoices/13150453");
    assert.deepEqual(requests[0]?.bodyJson, {
      purchase_order: "2345",
      subject: "ABC Project Quote",
      payment_term: "net 30",
      payment_options: ["credit_card"],
      line_items: [
        { kind: "Service", description: "New line", unit_price: 1000 },
        { id: 53341928, description: "Updated line", unit_price: 5000 },
        { id: 53341927, _destroy: true },
      ],
    });
  });

  it("omits unset header fields so Harvest leaves them unchanged", () => {
    const body = buildUpdateInvoiceBody(
      updateInvoiceInputSchema.parse({
        invoice_id: 1,
        notes: "Only notes",
      }),
    );
    assert.deepEqual(body, { notes: "Only notes" });
  });

  it("preserves multi-line invoice notes character-for-character", async () => {
    const notes = "  COS smoke — keep  verbatim\n\t#ref  ";
    const { client, requests } = createMockClient({
      responseBody: { id: 9, notes },
    });
    await updateInvoice(client, updateInvoiceInputSchema.parse({ invoice_id: 9, notes }));
    const sent = requests[0]?.bodyJson as { notes: string };
    assert.equal(sent.notes, notes);
    assert.notEqual(sent.notes, sent.notes.trim());
  });
});

describe("delete_invoice", () => {
  it("DELETEs /v2/invoices/{id}", async () => {
    const { client, requests } = createMockClient({ status: 200, responseText: "" });
    const result = await deleteInvoice(client, 13150453);
    assert.deepEqual(result, { ok: true, status: 200 });
    assert.equal(requests[0]?.method, "DELETE");
    assert.equal(requests[0]?.url, "https://api.harvestapp.com/v2/invoices/13150453");
    assert.equal(requests[0]?.bodyText, undefined);
  });
});
