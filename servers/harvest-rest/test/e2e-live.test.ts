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
describe("HARVEST_E2E_INVOICE_ID", () => {
  it("must parse to a positive integer", () => {
    assert.equal(parseE2eInvoiceId("42"), 42);
    assert.throws(() => parseE2eInvoiceId(undefined), /positive integer/);
    assert.throws(() => parseE2eInvoiceId("0"), /positive integer/);
    assert.throws(() => parseE2eInvoiceId("-3"), /positive integer/);
    assert.throws(() => parseE2eInvoiceId("draft"), /positive integer/);
    assert.throws(() => parseE2eInvoiceId("1.5"), /positive integer/);
  });
});

const live =
  Boolean(process.env.HARVEST_ACCESS_TOKEN) &&
  Boolean(process.env.HARVEST_ACCOUNT_ID) &&
  Boolean(process.env.HARVEST_E2E_INVOICE_ID) &&
  process.env.HARVEST_E2E_ALLOW_MUTATIONS === "1";

const VERBATIM_NOTES = "E2E notes — keep  verbatim\n\t#ref  ";

export function parseE2eInvoiceId(raw: string | undefined): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error(`HARVEST_E2E_INVOICE_ID must parse to a positive integer, got ${JSON.stringify(raw)}`);
  }
  return id;
}

describe("live Harvest CoS smoke (throwaway draft only)", { skip: !live }, () => {
  it("updates a throwaway draft and round-trips payment notes", async () => {
    const env = readHarvestEnv();
    const client = new HarvestClient(env);
    const invoiceId = parseE2eInvoiceId(process.env.HARVEST_E2E_INVOICE_ID);

    const existing = (await client.request({
      method: "GET",
      path: `/invoices/${invoiceId}`,
    })) as { id: number; state?: string };
    assert.equal(existing.id, invoiceId);
    assert.equal(existing.state, "draft", "HARVEST_E2E_INVOICE_ID must be a throwaway draft");

    let paymentId: number | undefined;
    try {
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

      paymentId = payment.id;
      assert.equal(payment.notes, VERBATIM_NOTES);
    } finally {
      if (paymentId !== undefined) {
        await deleteInvoicePayment(client, invoiceId, paymentId);
      }
    }

    if (process.env.HARVEST_E2E_DELETE_INVOICE === "1") {
      await deleteInvoice(client, invoiceId);
    }
  });
});
