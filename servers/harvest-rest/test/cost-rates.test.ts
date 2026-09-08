import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildCreateCostRateBody,
  createUserCostRate,
  createUserCostRateInputSchema,
  getUserCostRate,
  listUserCostRates,
} from "../src/tools/cost-rates.js";
import { createMockClient } from "./helpers.js";

const LIST_FIXTURE = {
  cost_rates: [{ id: 991, amount: 42.5, start_date: "2024-01-01", end_date: null }],
  total_entries: 1,
};

describe("user cost rates", () => {
  it("lists cost rates with optional pagination", async () => {
    const { client, requests } = createMockClient({ responseBody: LIST_FIXTURE });
    await listUserCostRates(client, { user_id: 3226125, per_page: 10 });
    assert.equal(requests[0]?.method, "GET");
    assert.equal(requests[0]?.url, "https://api.harvestapp.com/v2/users/3226125/cost_rates?per_page=10");
  });

  it("retrieves one cost rate", async () => {
    const { client, requests } = createMockClient({ responseBody: LIST_FIXTURE.cost_rates[0] });
    const result = (await getUserCostRate(client, { user_id: 3226125, cost_rate_id: 991 })) as { id: number };
    assert.equal(result.id, 991);
    assert.equal(requests[0]?.url, "https://api.harvestapp.com/v2/users/3226125/cost_rates/991");
  });

  it("creates a cost rate with amount and optional start_date", async () => {
    const { client, requests } = createMockClient({
      status: 201,
      responseBody: { id: 992, amount: 50, start_date: "2026-01-01" },
    });
    await createUserCostRate(client, { user_id: 3226125, amount: 50, start_date: "2026-01-01" });
    assert.equal(requests[0]?.method, "POST");
    assert.equal(requests[0]?.url, "https://api.harvestapp.com/v2/users/3226125/cost_rates");
    assert.deepEqual(requests[0]?.bodyJson, { amount: 50, start_date: "2026-01-01" });
  });

  it("omits start_date when not provided", () => {
    assert.deepEqual(buildCreateCostRateBody({ user_id: 1, amount: 40 }), { amount: 40 });
  });

  it("rejects a bad start_date at the schema", () => {
    const parsed = createUserCostRateInputSchema.safeParse({
      user_id: 1,
      amount: 1,
      start_date: "01/01/2026",
    });
    assert.equal(parsed.success, false);
  });
});
