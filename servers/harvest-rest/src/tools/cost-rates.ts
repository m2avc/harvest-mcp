import { z } from "zod";

import { HarvestConfigError } from "../env.js";
import type { HarvestClient } from "../harvest-client.js";
import { isoDateSchema } from "./iso-date.js";

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
    amount: z.number().finite(),
    start_date: isoDateSchema.optional(),
    confirm_replacement: z.literal(true).optional(),
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

export function existingCostRateStartDates(listed: unknown): string[] {
  if (!listed || typeof listed !== "object") {
    return [];
  }
  const rates = (listed as { cost_rates?: unknown }).cost_rates;
  if (!Array.isArray(rates)) {
    return [];
  }
  const starts: string[] = [];
  for (const rate of rates) {
    if (!rate || typeof rate !== "object") {
      continue;
    }
    const start = (rate as { start_date?: unknown }).start_date;
    if (typeof start === "string" && start.length > 0) {
      starts.push(start);
    }
  }
  return starts;
}

/** Omitted start_date replaces all rates; a date earlier than or equal to an existing start replaces it. */
export function isCostRateReplacement(startDate: string | undefined, existingStartDates: string[]): boolean {
  if (startDate === undefined) {
    return true;
  }
  return existingStartDates.some((existing) => startDate <= existing);
}

export function assertCostRateReplacementAcknowledged(
  input: CreateUserCostRateInput,
  existingStartDates: string[],
): void {
  if (!isCostRateReplacement(input.start_date, existingStartDates)) {
    return;
  }
  if (input.confirm_replacement === true) {
    return;
  }
  throw new HarvestConfigError(
    "create_user_cost_rate would replace existing rate(s). Pass confirm_replacement=true after explicit user confirmation. Omitting start_date replaces all rates; a start_date earlier than or equal to an existing rate replaces it.",
  );
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
  if (input.start_date === undefined) {
    assertCostRateReplacementAcknowledged(input, []);
  } else {
    const listed = await listUserCostRates(client, { user_id: input.user_id, per_page: 2000 });
    assertCostRateReplacementAcknowledged(input, existingCostRateStartDates(listed));
  }
  return client.request({
    method: "POST",
    path: `/users/${input.user_id}/cost_rates`,
    body: buildCreateCostRateBody(input),
  });
}
