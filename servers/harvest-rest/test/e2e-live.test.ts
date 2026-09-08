import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { readHarvestEnv } from "../src/env.js";
import { HarvestClient } from "../src/harvest-client.js";
import { createInvoicePayment, deleteInvoicePayment } from "../src/tools/invoice-payments.js";
import { deleteInvoice, updateInvoice } from "../src/tools/invoices.js";

/**
 * Live Harvest CoS smoke (skipped unless creds + throwaway draft id).
 *
 * ONLY: update a throwaway draft + payment notes round-trip.
 * NEVER: create_invoice_message email send, event_type=send, or send_thank_you.
 * Those paths stay unit/mocked or require DANGEROUS_SEND=1 + Mike GO.
 */
const live =
  Boolean(process.env.HARVEST_ACCESS_TOKEN) &&
  Boolean(process.env.HARVEST_ACCOUNT_ID) &&
  Boolean(process.env.HARVEST_E2E_INVOICE_ID) &&
  process.env.HARVEST_E2E_ALLOW_MUTATIONS === "1";

const VERBATIM_NOTES = "E2E notes — keep  verbatim\n\t#ref  ";

describe("live Harvest CoS smoke (throwaway draft only)", { skip: !live }, () => {
  it("updates a throwaway draft and round-trips payment notes", async () => {
    const env = readHarvestEnv();
    const client = new HarvestClient(env);
    const invoiceId = Number(process.env.HARVEST_E2E_INVOICE_ID);

    const updated = (await updateInvoice(client, {
      invoice_id: invoiceId,
      purchase_order: `cos-smoke-${Date.now()}`,
    })) as { id: number; state?: string };

    assert.equal(updated.id, invoiceId);
    if (updated.state !== undefined) {
      assert.equal(updated.state, "draft");
    }

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
