import { z } from "zod";

import { HarvestConfigError } from "../env.js";
import type { HarvestClient } from "../harvest-client.js";

export const updateProjectUserAssignmentInputSchema = z
  .object({
    project_id: z.coerce.number().int().positive(),
    user_assignment_id: z.coerce.number().int().positive(),
    use_default_rates: z.boolean().optional(),
    uses_default_rate: z.boolean().optional(),
    hourly_rate: z.number().optional(),
    is_active: z.boolean().optional(),
    is_project_manager: z.boolean().optional(),
    budget: z.number().optional(),
  })
  .strict();

export type UpdateProjectUserAssignmentInput = z.infer<typeof updateProjectUserAssignmentInputSchema>;

/**
 * REST field is `use_default_rates`. Official MCP list_project_assignments uses `uses_default_rate`.
 */
export function resolveUseDefaultRates(input: {
  use_default_rates?: boolean;
  uses_default_rate?: boolean;
}): boolean | undefined {
  const rest = input.use_default_rates;
  const alias = input.uses_default_rate;
  if (rest !== undefined && alias !== undefined && rest !== alias) {
    throw new HarvestConfigError("use_default_rates and uses_default_rate were both provided and do not match");
  }
  return rest ?? alias;
}

export function buildUpdateAssignmentBody(input: UpdateProjectUserAssignmentInput): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  const useDefault = resolveUseDefaultRates(input);
  if (useDefault !== undefined) {
    body.use_default_rates = useDefault;
  }
  if (input.hourly_rate !== undefined) {
    body.hourly_rate = input.hourly_rate;
  }
  if (input.is_active !== undefined) {
    body.is_active = input.is_active;
  }
  if (input.is_project_manager !== undefined) {
    body.is_project_manager = input.is_project_manager;
  }
  if (input.budget !== undefined) {
    body.budget = input.budget;
  }
  if (Object.keys(body).length === 0) {
    throw new HarvestConfigError(
      "Provide at least one field to update: use_default_rates / uses_default_rate, hourly_rate, is_active, is_project_manager, or budget",
    );
  }
  return body;
}

export async function updateProjectUserAssignment(
  client: HarvestClient,
  input: UpdateProjectUserAssignmentInput,
): Promise<unknown> {
  return client.request({
    method: "PATCH",
    path: `/projects/${input.project_id}/user_assignments/${input.user_assignment_id}`,
    body: buildUpdateAssignmentBody(input),
  });
}
