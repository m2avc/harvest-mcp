import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildCreateInvoicePaymentBody,
  createInvoicePayment,
  createInvoicePaymentInputSchema,
  deleteInvoicePayment,
  listInvoicePayments,
} from "../src/tools/invoice-payments.js";
import { createMockClient, VERBATIM_PAYMENT_NOTES } from "./helpers.js";

describe("create_invoice_payment notes round-trip", () => {
  it("preserves notes character-for-character in the POST body", async () => {
    const { client, requests } = createMockClient({
      responseBody: {
        id: 10336386,
        amount: 1575.86,
        notes: VERBATIM_PAYMENT_NOTES,
      },
    });

    const input = createInvoicePaymentInputSchema.parse({
      invoice_id: 13150378,
      amount: 1575.86,
      paid_at: "2017-07-24T13:32:18Z",
      notes: VERBATIM_PAYMENT_NOTES,
      send_thank_you: false,
    });

    const result = (await createInvoicePayment(client, input)) as { notes: string };
    const sent = requests[0]?.bodyJson as { notes: string };

    assert.equal(requests[0]?.method, "POST");
    assert.equal(requests[0]?.url, "https://api.harvestapp.com/v2/invoices/13150378/payments");
    assert.equal(sent.notes, VERBATIM_PAYMENT_NOTES);
    assert.equal(result.notes, VERBATIM_PAYMENT_NOTES);
    assert.equal(sent.notes.length, VERBATIM_PAYMENT_NOTES.length);
    assert.notEqual(sent.notes, sent.notes.trim());
  });

  it("does not trim, rewrite, or drop an empty notes string", () => {
    const body = buildCreateInvoicePaymentBody(
      createInvoicePaymentInputSchema.parse({
        invoice_id: 1,
        amount: 10,
        notes: "",
      }),
    );
    assert.equal(Object.hasOwn(body, "notes"), true);
    assert.equal(body.notes, "");
  });

  it("rejects paid_at and paid_date together", () => {
    const parsed = createInvoicePaymentInputSchema.safeParse({
      invoice_id: 1,
      amount: 1,
      paid_at: "2017-07-24T13:32:18Z",
      paid_date: "2017-07-24",
    });
    assert.equal(parsed.success, false);
  });
});

describe("list / delete invoice payments", () => {
  it("uses documented list and delete paths", async () => {
    const { client, requests } = createMockClient({ responseBody: { invoice_payments: [] } });
    await listInvoicePayments(client, { invoice_id: 13150378, updated_since: "2017-01-01T00:00:00Z" });
    await deleteInvoicePayment(client, 13150378, 10336386);

    assert.equal(
      requests[0]?.url,
      "https://api.harvestapp.com/v2/invoices/13150378/payments?updated_since=2017-01-01T00%3A00%3A00Z",
    );
    assert.equal(requests[1]?.method, "DELETE");
    assert.equal(requests[1]?.url, "https://api.harvestapp.com/v2/invoices/13150378/payments/10336386");
  });
});
