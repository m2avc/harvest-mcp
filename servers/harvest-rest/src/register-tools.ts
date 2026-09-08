import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { errorToolResult, jsonToolResult, type HarvestClient } from "./harvest-client.js";
import { listContacts, listContactsInputSchema } from "./tools/contacts.js";
import {
  createInvoiceMessage,
  createInvoiceMessageInputSchema,
  deleteInvoiceMessage,
  deleteInvoiceMessageInputSchema,
  listInvoiceMessages,
  listInvoiceMessagesInputSchema,
  previewInvoiceMessage,
  previewInvoiceMessageInputSchema,
} from "./tools/invoice-messages.js";
import {
  createInvoicePayment,
  createInvoicePaymentInputSchema,
  deleteInvoicePayment,
  deleteInvoicePaymentInputSchema,
  listInvoicePayments,
  listInvoicePaymentsInputSchema,
} from "./tools/invoice-payments.js";
import {
  createUserBillableRate,
  createUserBillableRateInputSchema,
  getUserBillableRate,
  getUserBillableRateInputSchema,
  listUserBillableRates,
  listUserBillableRatesInputSchema,
} from "./tools/billable-rates.js";
import {
  createUserCostRate,
  createUserCostRateInputSchema,
  getUserCostRate,
  getUserCostRateInputSchema,
  listUserCostRates,
  listUserCostRatesInputSchema,
} from "./tools/cost-rates.js";
import {
  createInvoiceItemCategory,
  createInvoiceItemCategoryInputSchema,
  getInvoiceItemCategory,
  getInvoiceItemCategoryInputSchema,
  listInvoiceItemCategories,
  listInvoiceItemCategoriesInputSchema,
} from "./tools/invoice-item-categories.js";
import { deleteInvoice, deleteInvoiceInputSchema, updateInvoice, updateInvoiceInputSchema } from "./tools/invoices.js";
import {
  updateProjectUserAssignment,
  updateProjectUserAssignmentInputSchema,
} from "./tools/user-assignments.js";

export const REST_TOOL_NAMES = [
  "update_invoice",
  "delete_invoice",
  "list_invoice_messages",
  "create_invoice_message",
  "preview_invoice_message",
  "delete_invoice_message",
  "list_invoice_payments",
  "create_invoice_payment",
  "delete_invoice_payment",
  "list_contacts",
  "list_user_billable_rates",
  "get_user_billable_rate",
  "create_user_billable_rate",
  "list_user_cost_rates",
  "get_user_cost_rate",
  "create_user_cost_rate",
  "list_invoice_item_categories",
  "get_invoice_item_category",
  "create_invoice_item_category",
  "update_project_user_assignment",
] as const;

export type RestToolName = (typeof REST_TOOL_NAMES)[number];

async function runTool(work: () => Promise<unknown>) {
  try {
    return jsonToolResult(await work());
  } catch (error) {
    return errorToolResult(error);
  }
}

/**
 * Registers Harvest REST v2 tools that the official remote MCP does not expose.
 * Invoice + rates + invoice item categories. Do not add a second stdio server.
 */
export function registerHarvestRestTools(server: McpServer, client: HarvestClient): void {
  server.registerTool(
    "update_invoice",
    {
      title: "Update invoice",
      description:
        "PATCH /v2/invoices/{INVOICE_ID}. Update invoice header fields and line items. Create a line item by omitting id; update by sending id; delete with id + _destroy=true. Official remote MCP cannot update invoices.",
      inputSchema: updateInvoiceInputSchema,
    },
    async (args) => runTool(() => updateInvoice(client, args)),
  );

  server.registerTool(
    "delete_invoice",
    {
      title: "Delete invoice",
      description: "DELETE /v2/invoices/{INVOICE_ID}. Permanently deletes the invoice. Requires clear user intent.",
      inputSchema: deleteInvoiceInputSchema,
    },
    async (args) => runTool(() => deleteInvoice(client, args.invoice_id)),
  );

  server.registerTool(
    "list_invoice_messages",
    {
      title: "List invoice messages",
      description: "GET /v2/invoices/{INVOICE_ID}/messages. Lists send/close/draft/re-open and email messages for an invoice.",
      inputSchema: listInvoiceMessagesInputSchema,
    },
    async (args) => runTool(() => listInvoiceMessages(client, args)),
  );

  server.registerTool(
    "create_invoice_message",
    {
      title: "Create invoice message",
      description:
        "POST /v2/invoices/{INVOICE_ID}/messages. Omit event_type to email the invoice (requires recipients and/or send_me_a_copy=true). event_type=send marks a draft as sent without emailing. event_type=close writes off an open invoice. event_type=draft marks an open invoice as draft. event_type=re-open reopens a closed invoice. Email send and event_type=send are blocked unless DANGEROUS_SEND=1 (Mike GO). Smoke tests must not use the send path. Do not claim the invoice was sent unless this tool succeeds.",
      inputSchema: createInvoiceMessageInputSchema,
    },
    async (args) => runTool(() => createInvoiceMessage(client, args)),
  );

  server.registerTool(
    "preview_invoice_message",
    {
      title: "Preview invoice message",
      description:
        "GET /v2/invoices/{INVOICE_ID}/messages/new. Returns Harvest-configured subject/body for a general, thank-you, or reminder message. Does not create or send a message.",
      inputSchema: previewInvoiceMessageInputSchema,
    },
    async (args) => runTool(() => previewInvoiceMessage(client, args)),
  );

  server.registerTool(
    "delete_invoice_message",
    {
      title: "Delete invoice message",
      description: "DELETE /v2/invoices/{INVOICE_ID}/messages/{MESSAGE_ID}.",
      inputSchema: deleteInvoiceMessageInputSchema,
    },
    async (args) => runTool(() => deleteInvoiceMessage(client, args.invoice_id, args.message_id)),
  );

  server.registerTool(
    "list_invoice_payments",
    {
      title: "List invoice payments",
      description: "GET /v2/invoices/{INVOICE_ID}/payments. Official remote MCP does not expose payment records.",
      inputSchema: listInvoicePaymentsInputSchema,
    },
    async (args) => runTool(() => listInvoicePayments(client, args)),
  );

  server.registerTool(
    "create_invoice_payment",
    {
      title: "Create invoice payment",
      description:
        "POST /v2/invoices/{INVOICE_ID}/payments. Records a payment. notes are sent character-for-character (do not rewrite). Pass either paid_at or paid_date, not both. send_thank_you is forced false unless DANGEROUS_SEND=1 and send_thank_you=true (Harvest's default thank-you email is not inherited).",
      inputSchema: createInvoicePaymentInputSchema,
    },
    async (args) => runTool(() => createInvoicePayment(client, args)),
  );

  server.registerTool(
    "delete_invoice_payment",
    {
      title: "Delete invoice payment",
      description: "DELETE /v2/invoices/{INVOICE_ID}/payments/{PAYMENT_ID}.",
      inputSchema: deleteInvoicePaymentInputSchema,
    },
    async (args) => runTool(() => deleteInvoicePayment(client, args.invoice_id, args.payment_id)),
  );

  server.registerTool(
    "list_contacts",
    {
      title: "List client contacts",
      description:
        "GET /v2/contacts. Minimal helper to resolve invoice email recipients (name, email, invoice_recipient_status). Filter with client_id. Not full contacts CRUD.",
      inputSchema: listContactsInputSchema,
    },
    async (args) => runTool(() => listContacts(client, args)),
  );

  server.registerTool(
    "list_user_billable_rates",
    {
      title: "List user billable rates",
      description:
        "GET /v2/users/{USER_ID}/billable_rates. Lists a user's default billable rates (oldest start_date first). Official remote MCP does not expose this. Requires Administrator or Manager permission to edit billable rates.",
      inputSchema: listUserBillableRatesInputSchema,
    },
    async (args) => runTool(() => listUserBillableRates(client, args)),
  );

  server.registerTool(
    "get_user_billable_rate",
    {
      title: "Get user billable rate",
      description:
        "GET /v2/users/{USER_ID}/billable_rates/{BILLABLE_RATE_ID}. Harvest API v2 supports retrieve. Official remote MCP does not expose this.",
      inputSchema: getUserBillableRateInputSchema,
    },
    async (args) => runTool(() => getUserBillableRate(client, args)),
  );

  server.registerTool(
    "create_user_billable_rate",
    {
      title: "Create user billable rate",
      description:
        "POST /v2/users/{USER_ID}/billable_rates. amount is required; start_date is optional (YYYY-MM-DD, not in the future). Creating with no start_date replaces existing rate(s). Official remote MCP does not expose this.",
      inputSchema: createUserBillableRateInputSchema,
    },
    async (args) => runTool(() => createUserBillableRate(client, args)),
  );

  server.registerTool(
    "list_user_cost_rates",
    {
      title: "List user cost rates",
      description:
        "GET /v2/users/{USER_ID}/cost_rates. Lists a user's cost rates (oldest start_date first). Official remote MCP does not expose this. Requires Administrator or Manager permission to edit cost rates.",
      inputSchema: listUserCostRatesInputSchema,
    },
    async (args) => runTool(() => listUserCostRates(client, args)),
  );

  server.registerTool(
    "get_user_cost_rate",
    {
      title: "Get user cost rate",
      description:
        "GET /v2/users/{USER_ID}/cost_rates/{COST_RATE_ID}. Harvest API v2 supports retrieve. Official remote MCP does not expose this.",
      inputSchema: getUserCostRateInputSchema,
    },
    async (args) => runTool(() => getUserCostRate(client, args)),
  );

  server.registerTool(
    "create_user_cost_rate",
    {
      title: "Create user cost rate",
      description:
        "POST /v2/users/{USER_ID}/cost_rates. amount is required; start_date is optional (YYYY-MM-DD, not in the future). Creating with no start_date replaces existing rate(s). Official remote MCP does not expose this.",
      inputSchema: createUserCostRateInputSchema,
    },
    async (args) => runTool(() => createUserCostRate(client, args)),
  );

  server.registerTool(
    "list_invoice_item_categories",
    {
      title: "List invoice item categories",
      description:
        "GET /v2/invoice_item_categories. Categories are the `kind` values used on invoice line items. Official remote MCP does not expose this.",
      inputSchema: listInvoiceItemCategoriesInputSchema,
    },
    async (args) => runTool(() => listInvoiceItemCategories(client, args)),
  );

  server.registerTool(
    "get_invoice_item_category",
    {
      title: "Get invoice item category",
      description: "GET /v2/invoice_item_categories/{INVOICE_ITEM_CATEGORY_ID}. Official remote MCP does not expose this.",
      inputSchema: getInvoiceItemCategoryInputSchema,
    },
    async (args) => runTool(() => getInvoiceItemCategory(client, args)),
  );

  server.registerTool(
    "create_invoice_item_category",
    {
      title: "Create invoice item category",
      description:
        "POST /v2/invoice_item_categories. name is required; optional use_as_service / use_as_expense. Official remote MCP does not expose this.",
      inputSchema: createInvoiceItemCategoryInputSchema,
    },
    async (args) => runTool(() => createInvoiceItemCategory(client, args)),
  );

  server.registerTool(
    "update_project_user_assignment",
    {
      title: "Update project user assignment",
      description:
        "PATCH /v2/projects/{PROJECT_ID}/user_assignments/{USER_ASSIGNMENT_ID}. Set use_default_rates (REST) or uses_default_rate (official MCP alias) and hourly_rate. Official assign_user_to_project accepts only project_id + user_id.",
      inputSchema: updateProjectUserAssignmentInputSchema,
    },
    async (args) => runTool(() => updateProjectUserAssignment(client, args)),
  );
}
