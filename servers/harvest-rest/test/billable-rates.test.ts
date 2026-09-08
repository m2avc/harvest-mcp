import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildCreateBillableRateBody,
  createUserBillableRate,
  createUserBillableRateInputSchema,
  getUserBillableRate,
  listUserBillableRates,
} from "../src/tools/billable-rates.js";
import { createMockClient } from "./helpers.js";

const LIST_FIXTURE = {
  billable_rates: [
    {
      id: 1836493,
      amount: 8.25,
      start_date: "2019-01-01",
      end_date: "2019-05-31",
    },
  ],
  total_entries: 1,
};

describe("billable rates", () => {
  it("lists rates with optional pagination", async () => {
    const { client, requests } = createMockClient({ responseBody: LIST_FIXTURE });
    const result = (await listUserBillableRates(client, { user_id: 3226125, per_page: 10 })) as {
      total_entries: number;
    };
    assert.equal(result.total_entries, 1);
    assert.equal(requests[0]?.method, "GET");
    assert.equal(requests[0]?.url, "https://api.harvestapp.com/v2/users/3226125/billable_rates?per_page=10");
    assert.equal(requests[0]?.bodyJson, undefined);
  });

  it("retrieves one rate (API v2 supports GET by id)", async () => {
    const { client, requests } = createMockClient({ responseBody: LIST_FIXTURE.billable_rates[0] });
    const result = (await getUserBillableRate(client, { user_id: 3226125, billable_rate_id: 1836493 })) as {
      id: number;
    };
    assert.equal(result.id, 1836493);
    assert.equal(requests[0]?.url, "https://api.harvestapp.com/v2/users/3226125/billable_rates/1836493");
  });

  it("creates a rate with amount and optional start_date", async () => {
    const { client, requests } = createMockClient({
      status: 201,
      responseBody: { id: 1836555, amount: 5.0, start_date: "2020-05-05" },
    });
    await createUserBillableRate(client, { user_id: 3226125, amount: 5.0, start_date: "2020-05-05" });
    assert.equal(requests[0]?.method, "POST");
    assert.equal(requests[0]?.url, "https://api.harvestapp.com/v2/users/3226125/billable_rates");
    assert.deepEqual(requests[0]?.bodyJson, { amount: 5.0, start_date: "2020-05-05" });
  });

  it("omits start_date from the body when not provided", () => {
    assert.deepEqual(buildCreateBillableRateBody({ user_id: 1, amount: 145 }), { amount: 145 });
  });

  it("rejects a bad start_date at the schema", () => {
    const parsed = createUserBillableRateInputSchema.safeParse({
      user_id: 1,
      amount: 1,
      start_date: "05/05/2020",
    });
    assert.equal(parsed.success, false);
  });
});
