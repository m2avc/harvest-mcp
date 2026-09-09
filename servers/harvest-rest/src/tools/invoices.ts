import { z } from "zod";

import type { HarvestClient } from "../harvest-client.js";

const paymentTermSchema = z.enum(["upon receipt", "net 15", "net 30", "net 45", "net 60", "custom"]);
const paymentOptionSchema = z.enum(["ach", "credit_card", "paypal"]);

export const invoiceLineItemSchema = z
  .object({
    id: z.coerce.number().int().positive().optional(),
    project_id: z.coerce.number().int().positive().optional(),
    kind: z.string().optional(),
    description: z.string().optional(),
    quantity: z.number().optional(),
    unit_price: z.number().optional(),
    taxed: z.boolean().optional(),
    taxed2: z.boolean().optional(),
    _destroy: z.boolean().optional(),
  })
  .strict()
  .superRefine((item, ctx) => {
    if (item._destroy === true && item.id === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Line items with _destroy=true must include a valid id.",
        path: ["id"],
      });
    }
  });

export const updateInvoiceInputSchema = z
  .object({
    invoice_id: z.coerce.number().int().positive(),
    client_id: z.coerce.number().int().positive().optional(),
    retainer_id: z.coerce.number().int().positive().optional(),
    estimate_id: z.coerce.number().int().positive().optional(),
    number: z.string().optional(),
    purchase_order: z.string().optional(),
    tax: z.number().optional(),
    tax2: z.number().optional(),
    discount: z.number().optional(),
    subject: z.string().optional(),
    notes: z.string().optional(),
    currency: z.string().optional(),
    issue_date: z.string().optional(),
    due_date: z.string().optional(),
    payment_term: paymentTermSchema.optional(),
    payment_options: z.array(paymentOptionSchema).optional(),
    line_items: z.array(invoiceLineItemSchema).optional(),
  })
  .strict();

export const deleteInvoiceInputSchema = z
  .object({
    invoice_id: z.coerce.number().int().positive(),
    confirm: z.literal(true),
  })
  .strict();

export type UpdateInvoiceInput = z.infer<typeof updateInvoiceInputSchema>;
export type InvoiceLineItemInput = z.infer<typeof invoiceLineItemSchema>;

const UPDATE_INVOICE_KEYS = [
  "client_id",
  "retainer_id",
  "estimate_id",
  "number",
  "purchase_order",
  "tax",
  "tax2",
  "discount",
  "subject",
  "notes",
  "currency",
  "issue_date",
  "due_date",
  "payment_term",
  "payment_options",
] as const;

export function buildUpdateInvoiceBody(input: UpdateInvoiceInput): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  for (const key of UPDATE_INVOICE_KEYS) {
    const value = input[key];
    if (value !== undefined) {
      body[key] = value;
    }
  }
  if (input.line_items !== undefined) {
    body.line_items = input.line_items.map(toLineItemPayload);
  }
  return body;
}

export function toLineItemPayload(item: InvoiceLineItemInput): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  if (item.id !== undefined) {
    payload.id = item.id;
  }
  if (item.project_id !== undefined) {
    payload.project_id = item.project_id;
  }
  if (item.kind !== undefined) {
    payload.kind = item.kind;
  }
  if (item.description !== undefined) {
    payload.description = item.description;
  }
  if (item.quantity !== undefined) {
    payload.quantity = item.quantity;
  }
  if (item.unit_price !== undefined) {
    payload.unit_price = item.unit_price;
  }
  if (item.taxed !== undefined) {
    payload.taxed = item.taxed;
  }
  if (item.taxed2 !== undefined) {
    payload.taxed2 = item.taxed2;
  }
  if (item._destroy !== undefined) {
    payload._destroy = item._destroy;
  }
  return payload;
}

export async function updateInvoice(client: HarvestClient, input: UpdateInvoiceInput): Promise<unknown> {
  return client.request({
    method: "PATCH",
    path: `/invoices/${input.invoice_id}`,
    body: buildUpdateInvoiceBody(input),
  });
}

export async function deleteInvoice(client: HarvestClient, invoiceId: number): Promise<unknown> {
  return client.request({
    method: "DELETE",
    path: `/invoices/${invoiceId}`,
  });
}
