import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { readHarvestEnv } from "../src/env.js";
import { HarvestClient } from "../src/harvest-client.js";
import { createInvoiceMessage } from "../src/tools/invoice-messages.js";
import { createInvoicePayment, deleteInvoicePayment } from "../src/tools/invoice-payments.js";
import { deleteInvoice, updateInvoice } from "../src/tools/invoices.js";

/**
 * Live Harvest E2E shape (skipped unless HARVEST_ACCESS_TOKEN + HARVEST_ACCOUNT_ID
 * and HARVEST_E2E_INVOICE_ID are set). Creates no invoices unless
 * HARVEST_E2E_ALLOW_MUTATIONS=1.
 *
 * Documented flow:
 * 1. update_invoice — PATCH header + optional line_items
 * 2. create_invoice_message event_type=send — mark draft sent (no email)
 * 3. create_invoice_payment — notes must equal the posted string exactly
 * 4. delete_invoice_payment — cleanup
 * 5. optional delete_invoice only when HARVEST_E2E_DELETE_INVOICE=1
 */
const live =
  Boolean(process.env.HARVEST_ACCESS_TOKEN) &&
  Boolean(process.env.HARVEST_ACCOUNT_ID) &&
  Boolean(process.env.HARVEST_E2E_INVOICE_ID) &&
  process.env.HARVEST_E2E_ALLOW_MUTATIONS === "1";

const VERBATIM_NOTES = "E2E notes — keep  verbatim\n\t#ref  ";

describe("live Harvest E2E (optional)", { skip: !live }, () => {
  it("updates an invoice, marks send, and round-trips payment notes", async () => {
    const env = readHarvestEnv();
    const client = new HarvestClient(env);
    const invoiceId = Number(process.env.HARVEST_E2E_INVOICE_ID);

    const updated = (await updateInvoice(client, {
      invoice_id: invoiceId,
      purchase_order: `e2e-${Date.now()}`,
    })) as { id: number };

    assert.equal(updated.id, invoiceId);

    const message = (await createInvoiceMessage(client, {
      invoice_id: invoiceId,
      event_type: "send",
    })) as { event_type: string };

    assert.equal(message.event_type, "send");

    const payment = (await createInvoicePayment(client, {
      invoice_id: invoiceId,
      amount: 0.01,
      paid_date: new Date().toISOString().slice(0, 10),
      notes: VERBATIM_NOTES,
      send_thank_you: false,
    })) as { id: number; notes: string };

    assert.equal(payment.notes, VERBATIM_NOTES);

    await deleteInvoicePayment(client, invoiceId, payment.id);

    if (process.env.HARVEST_E2E_DELETE_INVOICE === "1") {
      await deleteInvoice(client, invoiceId);
    }
  });
});
