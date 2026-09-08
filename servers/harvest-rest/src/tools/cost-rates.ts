import { z } from "zod";

import type { HarvestClient } from "../harvest-client.js";

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "start_date must be YYYY-MM-DD");

export const listUserCostRatesInputSchema = z
  .object({
    user_id: z.coerce.number().int().positive(),
    page: z.coerce.number().int().positive().optional(),
    per_page: z.coerce.number().int().min(1).max(2000).optional(),
  })
  .strict();

export const getUserCostRateInputSchema = z
  .object({
    user_id: z.coerce.number().int().positive(),
    cost_rate_id: z.coerce.number().int().positive(),
  })
  .strict();

export const createUserCostRateInputSchema = z
  .object({
    user_id: z.coerce.number().int().positive(),
    amount: z.number(),
    start_date: isoDateSchema.optional(),
  })
  .strict();

export type ListUserCostRatesInput = z.infer<typeof listUserCostRatesInputSchema>;
export type GetUserCostRateInput = z.infer<typeof getUserCostRateInputSchema>;
export type CreateUserCostRateInput = z.infer<typeof createUserCostRateInputSchema>;

export function buildCreateCostRateBody(input: CreateUserCostRateInput): Record<string, unknown> {
  const body: Record<string, unknown> = { amount: input.amount };
  if (input.start_date !== undefined) {
    body.start_date = input.start_date;
  }
  return body;
}

export async function listUserCostRates(client: HarvestClient, input: ListUserCostRatesInput): Promise<unknown> {
  return client.request({
    method: "GET",
    path: `/users/${input.user_id}/cost_rates`,
    query: {
      page: input.page,
      per_page: input.per_page,
    },
  });
}

export async function getUserCostRate(client: HarvestClient, input: GetUserCostRateInput): Promise<unknown> {
  return client.request({
    method: "GET",
    path: `/users/${input.user_id}/cost_rates/${input.cost_rate_id}`,
  });
}

export async function createUserCostRate(client: HarvestClient, input: CreateUserCostRateInput): Promise<unknown> {
  return client.request({
    method: "POST",
    path: `/users/${input.user_id}/cost_rates`,
    body: buildCreateCostRateBody(input),
  });
}
