import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getEstimate, listEstimates, listEstimatesInputSchema } from "../src/tools/estimates.js";
import { createMockClient } from "./helpers.js";

describe("estimates", () => {
  it("lists estimates with documented filters", async () => {
    const { client, requests } = createMockClient({
      responseBody: { estimates: [{ id: 1439818, state: "draft" }], total_entries: 1 },
    });
    await listEstimates(client, { client_id: 5735776, state: "draft", per_page: 10 });
    assert.equal(requests[0]?.method, "GET");
    assert.equal(
      requests[0]?.url,
      "https://api.harvestapp.com/v2/estimates?client_id=5735776&state=draft&per_page=10",
    );
  });

  it("retrieves one estimate", async () => {
    const { client, requests } = createMockClient({ responseBody: { id: 1439818, client_key: "abc" } });
    const result = (await getEstimate(client, { estimate_id: 1439818 })) as { id: number };
    assert.equal(result.id, 1439818);
    assert.equal(requests[0]?.url, "https://api.harvestapp.com/v2/estimates/1439818");
  });

  it("rejects an unknown estimate state", () => {
    const parsed = listEstimatesInputSchema.safeParse({ state: "open" });
    assert.equal(parsed.success, false);
  });

  it("accepts real calendar from/to dates including future dates", () => {
    assert.equal(
      listEstimatesInputSchema.safeParse({ from: "2020-01-01", to: "2099-12-31" }).success,
      true,
    );
  });

  it("rejects invalid from/to calendar dates", () => {
    assert.equal(listEstimatesInputSchema.safeParse({ from: "05/05/2020" }).success, false);
    assert.equal(listEstimatesInputSchema.safeParse({ to: "2026-02-30" }).success, false);
  });

  it("accepts updated_since as an ISO datetime with offset", () => {
    assert.equal(
      listEstimatesInputSchema.safeParse({ updated_since: "2026-01-01T00:00:00Z" }).success,
      true,
    );
  });

  it("rejects updated_since that is not an ISO datetime", () => {
    assert.equal(listEstimatesInputSchema.safeParse({ updated_since: "not-a-date" }).success, false);
    assert.equal(listEstimatesInputSchema.safeParse({ updated_since: "2026-01-01" }).success, false);
  });
});
