import { z } from "zod";

import type { HarvestClient } from "../harvest-client.js";

const estimateStateSchema = z.enum(["draft", "sent", "accepted", "declined"]);

export const listEstimatesInputSchema = z
  .object({
    client_id: z.coerce.number().int().positive().optional(),
    updated_since: z.string().optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    state: estimateStateSchema.optional(),
    page: z.coerce.number().int().positive().optional(),
    per_page: z.coerce.number().int().min(1).max(2000).optional(),
  })
  .strict();

export const getEstimateInputSchema = z
  .object({
    estimate_id: z.coerce.number().int().positive(),
  })
  .strict();

export type ListEstimatesInput = z.infer<typeof listEstimatesInputSchema>;
export type GetEstimateInput = z.infer<typeof getEstimateInputSchema>;

export async function listEstimates(client: HarvestClient, input: ListEstimatesInput): Promise<unknown> {
  return client.request({
    method: "GET",
    path: "/estimates",
    query: {
      client_id: input.client_id,
      updated_since: input.updated_since,
      from: input.from,
      to: input.to,
      state: input.state,
      page: input.page,
      per_page: input.per_page,
    },
  });
}

export async function getEstimate(client: HarvestClient, input: GetEstimateInput): Promise<unknown> {
  return client.request({
    method: "GET",
    path: `/estimates/${input.estimate_id}`,
  });
}
