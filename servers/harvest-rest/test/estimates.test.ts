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
});
