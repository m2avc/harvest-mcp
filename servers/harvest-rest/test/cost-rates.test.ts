import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { HarvestConfigError } from "../src/env.js";
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

  it("creates a cost rate after the latest existing start_date without replacement confirm", async () => {
    const { client, requests } = createMockClient({
      responses: [
        { responseBody: LIST_FIXTURE },
        { status: 201, responseBody: { id: 992, amount: 50, start_date: "2026-01-01" } },
      ],
    });
    await createUserCostRate(client, { user_id: 3226125, amount: 50, start_date: "2026-01-01" });
    assert.equal(requests[0]?.method, "GET");
    assert.equal(requests[1]?.method, "POST");
    assert.equal(requests[1]?.url, "https://api.harvestapp.com/v2/users/3226125/cost_rates");
    assert.deepEqual(requests[1]?.bodyJson, { amount: 50, start_date: "2026-01-01" });
  });

  it("requires confirm_replacement when start_date is omitted", async () => {
    const { client, requests } = createMockClient({ responseBody: { id: 1 } });
    await assert.rejects(
      () => createUserCostRate(client, { user_id: 1, amount: 40 }),
      (error: unknown) => error instanceof HarvestConfigError && /confirm_replacement=true/.test(error.message),
    );
    assert.equal(requests.length, 0);
  });

  it("POSTs without start_date when omitted start_date is acknowledged", async () => {
    const { client, requests } = createMockClient({
      status: 201,
      responseBody: { id: 993, amount: 40 },
    });
    await createUserCostRate(client, { user_id: 1, amount: 40, confirm_replacement: true });
    assert.equal(requests.length, 1);
    assert.equal(requests[0]?.method, "POST");
    assert.deepEqual(requests[0]?.bodyJson, { amount: 40 });
  });

  it("requires confirm_replacement when start_date is earlier than or equal to an existing rate", async () => {
    const { client, requests } = createMockClient({
      responses: [{ responseBody: LIST_FIXTURE }, { responseBody: LIST_FIXTURE }],
    });
    await assert.rejects(
      () => createUserCostRate(client, { user_id: 3226125, amount: 30, start_date: "2020-01-01" }),
      (error: unknown) => error instanceof HarvestConfigError && /confirm_replacement=true/.test(error.message),
    );
    await assert.rejects(
      () => createUserCostRate(client, { user_id: 3226125, amount: 30, start_date: "2024-01-01" }),
      (error: unknown) => error instanceof HarvestConfigError && /confirm_replacement=true/.test(error.message),
    );
    assert.equal(requests.length, 2);
    assert.equal(requests[0]?.method, "GET");
    assert.equal(requests[1]?.method, "GET");
  });

  it("POSTs an equal start_date when replacement is acknowledged", async () => {
    const { client, requests } = createMockClient({
      responses: [
        { responseBody: LIST_FIXTURE },
        { status: 201, responseBody: { id: 995, amount: 30, start_date: "2024-01-01" } },
      ],
    });
    await createUserCostRate(client, {
      user_id: 3226125,
      amount: 30,
      start_date: "2024-01-01",
      confirm_replacement: true,
    });
    assert.equal(requests[0]?.method, "GET");
    assert.equal(requests[1]?.method, "POST");
    assert.deepEqual(requests[1]?.bodyJson, { amount: 30, start_date: "2024-01-01" });
  });

  it("POSTs a backdated start_date when replacement is acknowledged", async () => {
    const { client, requests } = createMockClient({
      responses: [
        { responseBody: LIST_FIXTURE },
        { status: 201, responseBody: { id: 994, amount: 30, start_date: "2020-01-01" } },
      ],
    });
    await createUserCostRate(client, {
      user_id: 3226125,
      amount: 30,
      start_date: "2020-01-01",
      confirm_replacement: true,
    });
    assert.equal(requests[0]?.method, "GET");
    assert.equal(requests[1]?.method, "POST");
    assert.deepEqual(requests[1]?.bodyJson, { amount: 30, start_date: "2020-01-01" });
  });

  it("omits start_date when not provided", () => {
    assert.deepEqual(buildCreateCostRateBody({ user_id: 1, amount: 40 }), { amount: 40 });
  });

  it("rejects a non-finite amount at the schema", () => {
    for (const amount of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      assert.equal(createUserCostRateInputSchema.safeParse({ user_id: 1, amount }).success, false);
    }
    assert.equal(createUserCostRateInputSchema.safeParse({ user_id: 1, amount: 40 }).success, true);
  });

  it("rejects a bad, impossible, or future start_date at the schema", () => {
    assert.equal(
      createUserCostRateInputSchema.safeParse({
        user_id: 1,
        amount: 1,
        start_date: "01/01/2026",
      }).success,
      false,
    );
    assert.equal(
      createUserCostRateInputSchema.safeParse({
        user_id: 1,
        amount: 1,
        start_date: "2026-02-30",
      }).success,
      false,
    );
    assert.equal(
      createUserCostRateInputSchema.safeParse({
        user_id: 1,
        amount: 1,
        start_date: "2099-01-01",
      }).success,
      false,
    );
    assert.equal(
      createUserCostRateInputSchema.safeParse({
        user_id: 1,
        amount: 1,
        start_date: "2020-01-01",
      }).success,
      true,
    );
  });
});
