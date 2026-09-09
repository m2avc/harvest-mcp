import { z } from "zod";

import type { HarvestClient } from "../harvest-client.js";
import { isoDateSchema } from "./iso-date.js";

export const listUserBillableRatesInputSchema = z
  .object({
    user_id: z.coerce.number().int().positive(),
    page: z.coerce.number().int().positive().optional(),
    per_page: z.coerce.number().int().min(1).max(2000).optional(),
  })
  .strict();

export const getUserBillableRateInputSchema = z
  .object({
    user_id: z.coerce.number().int().positive(),
    billable_rate_id: z.coerce.number().int().positive(),
  })
  .strict();

export const createUserBillableRateInputSchema = z
  .object({
    user_id: z.coerce.number().int().positive(),
    amount: z.number().finite(),
    start_date: isoDateSchema.optional(),
  })
  .strict();

export type ListUserBillableRatesInput = z.infer<typeof listUserBillableRatesInputSchema>;
export type GetUserBillableRateInput = z.infer<typeof getUserBillableRateInputSchema>;
export type CreateUserBillableRateInput = z.infer<typeof createUserBillableRateInputSchema>;

export function buildCreateBillableRateBody(input: CreateUserBillableRateInput): Record<string, unknown> {
  const body: Record<string, unknown> = { amount: input.amount };
  if (input.start_date !== undefined) {
    body.start_date = input.start_date;
  }
  return body;
}

export async function listUserBillableRates(
  client: HarvestClient,
  input: ListUserBillableRatesInput,
): Promise<unknown> {
  return client.request({
    method: "GET",
    path: `/users/${input.user_id}/billable_rates`,
    query: {
      page: input.page,
      per_page: input.per_page,
    },
  });
}

export async function getUserBillableRate(client: HarvestClient, input: GetUserBillableRateInput): Promise<unknown> {
  return client.request({
    method: "GET",
    path: `/users/${input.user_id}/billable_rates/${input.billable_rate_id}`,
  });
}

export async function createUserBillableRate(
  client: HarvestClient,
  input: CreateUserBillableRateInput,
): Promise<unknown> {
  return client.request({
    method: "POST",
    path: `/users/${input.user_id}/billable_rates`,
    body: buildCreateBillableRateBody(input),
  });
}
