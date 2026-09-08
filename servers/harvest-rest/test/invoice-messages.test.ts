import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildCreateInvoiceMessageBody,
  createInvoiceMessage,
  createInvoiceMessageInputSchema,
  deleteInvoiceMessage,
  listInvoiceMessages,
  previewInvoiceMessage,
} from "../src/tools/invoice-messages.js";
import { createMockClient } from "./helpers.js";

describe("create_invoice_message", () => {
  it("POSTs event_type=send to mark a draft as sent without requiring recipients", async () => {
    const { client, requests } = createMockClient({
      responseBody: { id: 27835325, event_type: "send" },
    });

    const input = createInvoiceMessageInputSchema.parse({
      invoice_id: 13150403,
      event_type: "send",
    });
    const result = await createInvoiceMessage(client, input);

    assert.deepEqual(result, { id: 27835325, event_type: "send" });
    assert.equal(requests[0]?.method, "POST");
    assert.equal(requests[0]?.url, "https://api.harvestapp.com/v2/invoices/13150403/messages");
    assert.deepEqual(requests[0]?.bodyJson, { event_type: "send" });
  });

  it("supports close, draft, and re-open event types", () => {
    for (const event_type of ["close", "draft", "re-open"] as const) {
      const body = buildCreateInvoiceMessageBody(
        createInvoiceMessageInputSchema.parse({ invoice_id: 1, event_type }),
      );
      assert.deepEqual(body, { event_type });
    }
  });

  it("emails the invoice when event_type is omitted and recipients are present", async () => {
    const { client, requests } = createMockClient({
      responseBody: { id: 27835324, event_type: null, subject: "Invoice #1001" },
    });

    const input = createInvoiceMessageInputSchema.parse({
      invoice_id: 13150403,
      subject: "Invoice #1001",
      body: "The invoice is attached below.",
      attach_pdf: true,
      send_me_a_copy: true,
      recipients: [{ name: "Richard Roe", email: "richard@example.com" }],
    });
    await createInvoiceMessage(client, input);

    assert.deepEqual(requests[0]?.bodyJson, {
      recipients: [{ name: "Richard Roe", email: "richard@example.com" }],
      subject: "Invoice #1001",
      body: "The invoice is attached below.",
      attach_pdf: true,
      send_me_a_copy: true,
    });
    assert.equal(Object.hasOwn(requests[0]?.bodyJson as object, "event_type"), false);
  });

  it("rejects an email send with no recipients and send_me_a_copy not true", () => {
    assert.throws(
      () =>
        buildCreateInvoiceMessageBody(
          createInvoiceMessageInputSchema.parse({
            invoice_id: 1,
            subject: "Hi",
          }),
        ),
      /recipients/,
    );
  });
});

describe("preview / list / delete invoice messages", () => {
  it("previews GET /messages/new without creating a message", async () => {
    const { client, requests } = createMockClient({
      responseBody: { invoice_id: 13150403, subject: "Reminder", body: "Please pay" },
    });
    await previewInvoiceMessage(client, { invoice_id: 13150403, reminder: true });
    assert.equal(requests[0]?.method, "GET");
    assert.equal(requests[0]?.url, "https://api.harvestapp.com/v2/invoices/13150403/messages/new?reminder=true");
    assert.equal(requests[0]?.bodyText, undefined);
  });

  it("lists and deletes messages on the documented paths", async () => {
    const { client, requests } = createMockClient({ responseBody: { invoice_messages: [] } });
    await listInvoiceMessages(client, { invoice_id: 9, per_page: 50 });
    await deleteInvoiceMessage(client, 9, 27835324);

    assert.equal(requests[0]?.method, "GET");
    assert.equal(requests[0]?.url, "https://api.harvestapp.com/v2/invoices/9/messages?per_page=50");
    assert.equal(requests[1]?.method, "DELETE");
    assert.equal(requests[1]?.url, "https://api.harvestapp.com/v2/invoices/9/messages/27835324");
  });
});
