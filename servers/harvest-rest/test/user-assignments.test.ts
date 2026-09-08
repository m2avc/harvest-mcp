import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { HarvestConfigError } from "../src/env.js";
import {
  buildUpdateAssignmentBody,
  resolveUseDefaultRates,
  updateProjectUserAssignment,
} from "../src/tools/user-assignments.js";
import { createMockClient } from "./helpers.js";

describe("project user assignment rates", () => {
  it("maps uses_default_rate alias to REST use_default_rates", () => {
    assert.equal(resolveUseDefaultRates({ uses_default_rate: false }), false);
    assert.deepEqual(buildUpdateAssignmentBody({ project_id: 1, user_assignment_id: 2, uses_default_rate: false, hourly_rate: 75.5 }), {
      use_default_rates: false,
      hourly_rate: 75.5,
    });
  });

  it("accepts matching aliases and rejects conflicts", () => {
    assert.equal(resolveUseDefaultRates({ use_default_rates: true, uses_default_rate: true }), true);
    assert.throws(
      () => resolveUseDefaultRates({ use_default_rates: true, uses_default_rate: false }),
      (error: unknown) => error instanceof HarvestConfigError,
    );
  });

  it("requires at least one update field", () => {
    assert.throws(
      () => buildUpdateAssignmentBody({ project_id: 1, user_assignment_id: 2 }),
      (error: unknown) => error instanceof HarvestConfigError,
    );
  });

  it("PATCHes assignment hourly rate", async () => {
    const { client, requests } = createMockClient({
      responseBody: { id: 125068758, use_default_rates: false, hourly_rate: 75.5 },
    });
    await updateProjectUserAssignment(client, {
      project_id: 14308069,
      user_assignment_id: 125068758,
      uses_default_rate: false,
      hourly_rate: 75.5,
    });
    assert.equal(requests[0]?.method, "PATCH");
    assert.equal(requests[0]?.url, "https://api.harvestapp.com/v2/projects/14308069/user_assignments/125068758");
    assert.deepEqual(requests[0]?.bodyJson, { use_default_rates: false, hourly_rate: 75.5 });
  });
});
