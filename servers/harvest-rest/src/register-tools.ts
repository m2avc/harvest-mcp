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
import { deleteInvoice, deleteInvoiceInputSchema, updateInvoice, updateInvoiceInputSchema } from "./tools/invoices.js";

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
 * Add further gap tools (for example billable rates) in this same server.
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
}
