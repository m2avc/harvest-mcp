import { z } from "zod";

import type { HarvestClient } from "../harvest-client.js";

export const listInvoiceItemCategoriesInputSchema = z
  .object({
    updated_since: z.string().datetime({ offset: true }).optional(),
    page: z.coerce.number().int().positive().optional(),
    per_page: z.coerce.number().int().min(1).max(2000).optional(),
  })
  .strict();

export const getInvoiceItemCategoryInputSchema = z
  .object({
    invoice_item_category_id: z.coerce.number().int().positive(),
  })
  .strict();

export const createInvoiceItemCategoryInputSchema = z
  .object({
    name: z.string().min(1),
    use_as_service: z.boolean().optional(),
    use_as_expense: z.boolean().optional(),
  })
  .strict();

export type ListInvoiceItemCategoriesInput = z.infer<typeof listInvoiceItemCategoriesInputSchema>;
export type GetInvoiceItemCategoryInput = z.infer<typeof getInvoiceItemCategoryInputSchema>;
export type CreateInvoiceItemCategoryInput = z.infer<typeof createInvoiceItemCategoryInputSchema>;

export function buildCreateInvoiceItemCategoryBody(input: CreateInvoiceItemCategoryInput): Record<string, unknown> {
  const body: Record<string, unknown> = { name: input.name };
  if (input.use_as_service !== undefined) {
    body.use_as_service = input.use_as_service;
  }
  if (input.use_as_expense !== undefined) {
    body.use_as_expense = input.use_as_expense;
  }
  return body;
}

export async function listInvoiceItemCategories(
  client: HarvestClient,
  input: ListInvoiceItemCategoriesInput,
): Promise<unknown> {
  return client.request({
    method: "GET",
    path: "/invoice_item_categories",
    query: {
      updated_since: input.updated_since,
      page: input.page,
      per_page: input.per_page,
    },
  });
}

export async function getInvoiceItemCategory(
  client: HarvestClient,
  input: GetInvoiceItemCategoryInput,
): Promise<unknown> {
  return client.request({
    method: "GET",
    path: `/invoice_item_categories/${input.invoice_item_category_id}`,
  });
}

export async function createInvoiceItemCategory(
  client: HarvestClient,
  input: CreateInvoiceItemCategoryInput,
): Promise<unknown> {
  return client.request({
    method: "POST",
    path: "/invoice_item_categories",
    body: buildCreateInvoiceItemCategoryBody(input),
  });
}
