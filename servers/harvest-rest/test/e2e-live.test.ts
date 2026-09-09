import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";

import { readHarvestEnv } from "../src/env.js";
import { HarvestClient } from "../src/harvest-client.js";
import { createInvoicePayment, deleteInvoicePayment, listInvoicePayments } from "../src/tools/invoice-payments.js";
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

function paymentNotesWithMarker(marker: string): string {
  return `${VERBATIM_NOTES}\n${marker}`;
}

function findPaymentIdByMarker(listed: unknown, marker: string): number | undefined {
  if (!listed || typeof listed !== "object") {
    return undefined;
  }
  const payments = (listed as { invoice_payments?: unknown }).invoice_payments;
  if (!Array.isArray(payments)) {
    return undefined;
  }
  for (const item of payments) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const payment = item as { id?: unknown; notes?: unknown };
    if (typeof payment.notes === "string" && payment.notes.includes(marker) && typeof payment.id === "number") {
      return payment.id;
    }
  }
  return undefined;
}

describe("live Harvest CoS smoke (throwaway draft only)", { skip: !live }, () => {
  it("updates a throwaway draft and round-trips payment notes", async () => {
    const env = readHarvestEnv();
    const client = new HarvestClient(env);
    const invoiceId = parseE2eInvoiceId(process.env.HARVEST_E2E_INVOICE_ID);
    const marker = `e2e-marker-${Date.now()}-${randomUUID()}`;
    const notes = paymentNotesWithMarker(marker);

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
        notes,
        send_thank_you: false,
      })) as { id?: number; notes?: string };

      assert.equal(payment.notes, notes);
      assert.match(payment.notes ?? "", new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

      paymentId = typeof payment.id === "number" ? payment.id : undefined;
      if (paymentId === undefined) {
        const listed = await listInvoicePayments(client, { invoice_id: invoiceId });
        paymentId = findPaymentIdByMarker(listed, marker);
      }
      assert.ok(paymentId !== undefined, "payment id missing after create and list-by-marker");
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

describe("e2e payment marker helpers", () => {
  it("locates only the payment whose notes include the unique marker", () => {
    const marker = "e2e-marker-unique-1";
    const listed = {
      invoice_payments: [
        { id: 11, notes: "other" },
        { id: 22, notes: paymentNotesWithMarker(marker) },
        { id: 33, notes: "e2e-marker-unique-2" },
      ],
    };
    assert.equal(findPaymentIdByMarker(listed, marker), 22);
    assert.equal(findPaymentIdByMarker({ invoice_payments: [] }, marker), undefined);
  });
});
