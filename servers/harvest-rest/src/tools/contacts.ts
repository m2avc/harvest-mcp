import { z } from "zod";

import type { HarvestClient } from "../harvest-client.js";

/**
 * Read-only contacts list so agents can resolve invoice message recipients.
 * Full contacts CRUD is intentionally omitted.
 */
export const listContactsInputSchema = z
  .object({
    client_id: z.coerce.number().int().positive().optional(),
    updated_since: z.string().optional(),
    page: z.coerce.number().int().positive().optional(),
    per_page: z.coerce.number().int().min(1).max(2000).optional(),
  })
  .strict();

export async function listContacts(client: HarvestClient, input: z.infer<typeof listContactsInputSchema>): Promise<unknown> {
  return client.request({
    method: "GET",
    path: "/contacts",
    query: {
      client_id: input.client_id,
      updated_since: input.updated_since,
      page: input.page,
      per_page: input.per_page,
    },
  });
}
