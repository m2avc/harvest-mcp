import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildCreateInvoiceItemCategoryBody,
  createInvoiceItemCategory,
  getInvoiceItemCategory,
  listInvoiceItemCategories,
  listInvoiceItemCategoriesInputSchema,
} from "../src/tools/invoice-item-categories.js";
import { createMockClient } from "./helpers.js";

describe("invoice item categories", () => {
  it("lists categories with optional pagination", async () => {
    const { client, requests } = createMockClient({
      responseBody: { invoice_item_categories: [{ id: 1, name: "Service" }], total_entries: 1 },
    });
    await listInvoiceItemCategories(client, { per_page: 50, updated_since: "2026-01-01T00:00:00Z" });
    assert.equal(requests[0]?.method, "GET");
    assert.equal(
      requests[0]?.url,
      "https://api.harvestapp.com/v2/invoice_item_categories?updated_since=2026-01-01T00%3A00%3A00Z&per_page=50",
    );
  });

  it("retrieves one category", async () => {
    const { client, requests } = createMockClient({ responseBody: { id: 1466293, name: "Product" } });
    const result = (await getInvoiceItemCategory(client, { invoice_item_category_id: 1466293 })) as { id: number };
    assert.equal(result.id, 1466293);
    assert.equal(requests[0]?.url, "https://api.harvestapp.com/v2/invoice_item_categories/1466293");
  });

  it("creates a category with name and optional flags", async () => {
    const { client, requests } = createMockClient({
      status: 201,
      responseBody: { id: 9, name: "Hardware", use_as_service: false, use_as_expense: true },
    });
    await createInvoiceItemCategory(client, { name: "Hardware", use_as_expense: true });
    assert.equal(requests[0]?.method, "POST");
    assert.equal(requests[0]?.url, "https://api.harvestapp.com/v2/invoice_item_categories");
    assert.deepEqual(requests[0]?.bodyJson, { name: "Hardware", use_as_expense: true });
  });

  it("omits unset flags from the create body", () => {
    assert.deepEqual(buildCreateInvoiceItemCategoryBody({ name: "Service" }), { name: "Service" });
  });

  it("rejects updated_since that is not an ISO datetime", () => {
    const parsed = listInvoiceItemCategoriesInputSchema.safeParse({ updated_since: "not-a-date" });
    assert.equal(parsed.success, false);
  });
});
