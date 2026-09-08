import { z } from "zod";

import { assertDangerousSendAllowed } from "../env.js";
import type { HarvestClient } from "../harvest-client.js";

export const createInvoicePaymentInputSchema = z
  .object({
    invoice_id: z.coerce.number().int().positive(),
    amount: z.number(),
    paid_at: z.string().optional(),
    paid_date: z.string().optional(),
    notes: z.string().optional(),
    send_thank_you: z.boolean().optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.paid_at !== undefined && value.paid_date !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Pass either paid_at or paid_date, but not both (Harvest API v2).",
      });
    }
  });

export const listInvoicePaymentsInputSchema = z
  .object({
    invoice_id: z.coerce.number().int().positive(),
    updated_since: z.string().optional(),
    page: z.coerce.number().int().positive().optional(),
    per_page: z.coerce.number().int().min(1).max(2000).optional(),
  })
  .strict();

export const deleteInvoicePaymentInputSchema = z
  .object({
    invoice_id: z.coerce.number().int().positive(),
    payment_id: z.coerce.number().int().positive(),
  })
  .strict();

export type CreateInvoicePaymentInput = z.infer<typeof createInvoicePaymentInputSchema>;

/**
 * Build the Harvest payment POST body. `notes` is copied by reference with no
 * trim / rewrite — character-for-character preservation is required.
 *
 * `send_thank_you` is forced false unless explicitly true *and* DANGEROUS_SEND=1,
 * so we never inherit Harvest's default thank-you email on full payment.
 */
export function buildCreateInvoicePaymentBody(
  input: CreateInvoicePaymentInput,
  env: NodeJS.ProcessEnv = process.env,
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    amount: input.amount,
  };
  if (input.paid_at !== undefined) {
    body.paid_at = input.paid_at;
  }
  if (input.paid_date !== undefined) {
    body.paid_date = input.paid_date;
  }
  if (input.notes !== undefined) {
    body.notes = input.notes;
  }
  if (input.send_thank_you === true) {
    assertDangerousSendAllowed("create_invoice_payment send_thank_you=true", env);
    body.send_thank_you = true;
  } else {
    body.send_thank_you = false;
  }
  return body;
}

export async function listInvoicePayments(
  client: HarvestClient,
  input: z.infer<typeof listInvoicePaymentsInputSchema>,
): Promise<unknown> {
  return client.request({
    method: "GET",
    path: `/invoices/${input.invoice_id}/payments`,
    query: {
      updated_since: input.updated_since,
      page: input.page,
      per_page: input.per_page,
    },
  });
}

export async function createInvoicePayment(
  client: HarvestClient,
  input: CreateInvoicePaymentInput,
  env: NodeJS.ProcessEnv = process.env,
): Promise<unknown> {
  return client.request({
    method: "POST",
    path: `/invoices/${input.invoice_id}/payments`,
    body: buildCreateInvoicePaymentBody(input, env),
  });
}

export async function deleteInvoicePayment(client: HarvestClient, invoiceId: number, paymentId: number): Promise<unknown> {
  return client.request({
    method: "DELETE",
    path: `/invoices/${invoiceId}/payments/${paymentId}`,
  });
}
