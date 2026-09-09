import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { DangerousSendBlockedError } from "../src/env.js";
import {
  buildCreateInvoiceMessageBody,
  createInvoiceMessage,
  createInvoiceMessageInputSchema,
  deleteInvoiceMessage,
  deleteInvoiceMessageInputSchema,
  listInvoiceMessages,
  previewInvoiceMessage,
} from "../src/tools/invoice-messages.js";
import { createMockClient } from "./helpers.js";

const allowSend = { DANGEROUS_SEND: "1" };

describe("create_invoice_message", () => {
  it("blocks event_type=send unless DANGEROUS_SEND=1", async () => {
    const { client, requests } = createMockClient({
      responseBody: { id: 27835325, event_type: "send" },
    });
    const input = createInvoiceMessageInputSchema.parse({
      invoice_id: 13150403,
      event_type: "send",
    });
    await assert.rejects(
      () => createInvoiceMessage(client, input, {}),
      (error: unknown) => error instanceof DangerousSendBlockedError,
    );
    assert.equal(requests.length, 0);
  });

  it("POSTs event_type=send when DANGEROUS_SEND=1 (mocked; no live email)", async () => {
    const { client, requests } = createMockClient({
      responseBody: { id: 27835325, event_type: "send" },
    });

    const input = createInvoiceMessageInputSchema.parse({
      invoice_id: 13150403,
      event_type: "send",
    });
    const result = await createInvoiceMessage(client, input, allowSend);

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

  it("blocks email (omit event_type) unless DANGEROUS_SEND=1", async () => {
    const { client, requests } = createMockClient({
      responseBody: { id: 1, event_type: null },
    });
    const input = createInvoiceMessageInputSchema.parse({
      invoice_id: 13150403,
      recipients: [{ name: "Richard Roe", email: "richard@example.com" }],
    });
    await assert.rejects(
      () => createInvoiceMessage(client, input, {}),
      (error: unknown) => error instanceof DangerousSendBlockedError,
    );
    assert.equal(requests.length, 0);
  });

  it("emails the invoice when event_type is omitted, recipients are present, and DANGEROUS_SEND=1 (mocked)", async () => {
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
    await createInvoiceMessage(client, input, allowSend);

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

  it("requires confirm=true to delete a message", () => {
    assert.equal(
      deleteInvoiceMessageInputSchema.safeParse({ invoice_id: 9, message_id: 1 }).success,
      false,
    );
    assert.equal(
      deleteInvoiceMessageInputSchema.safeParse({ invoice_id: 9, message_id: 1, confirm: true }).success,
      true,
    );
  });
});
