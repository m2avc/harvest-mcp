import { z } from "zod";

import { assertDangerousSendAllowed } from "../env.js";
import type { HarvestClient } from "../harvest-client.js";

export const invoiceMessageEventTypes = ["send", "close", "draft", "re-open"] as const;
export type InvoiceMessageEventType = (typeof invoiceMessageEventTypes)[number];

const eventTypeSchema = z.enum(invoiceMessageEventTypes);

export const invoiceMessageRecipientSchema = z
  .object({
    name: z.string().optional(),
    email: z.string().min(1),
  })
  .strict();

export const createInvoiceMessageInputSchema = z
  .object({
    invoice_id: z.coerce.number().int().positive(),
    event_type: eventTypeSchema.optional(),
    recipients: z.array(invoiceMessageRecipientSchema).optional(),
    subject: z.string().optional(),
    body: z.string().optional(),
    attach_pdf: z.boolean().optional(),
    send_me_a_copy: z.boolean().optional(),
    thank_you: z.boolean().optional(),
    include_link_to_client_invoice: z.boolean().optional(),
  })
  .strict();

export const listInvoiceMessagesInputSchema = z
  .object({
    invoice_id: z.coerce.number().int().positive(),
    updated_since: z.string().optional(),
    page: z.coerce.number().int().positive().optional(),
    per_page: z.coerce.number().int().min(1).max(2000).optional(),
  })
  .strict();

export const deleteInvoiceMessageInputSchema = z
  .object({
    invoice_id: z.coerce.number().int().positive(),
    message_id: z.coerce.number().int().positive(),
  })
  .strict();

export const previewInvoiceMessageInputSchema = z
  .object({
    invoice_id: z.coerce.number().int().positive(),
    thank_you: z.boolean().optional(),
    reminder: z.boolean().optional(),
  })
  .strict();

export type CreateInvoiceMessageInput = z.infer<typeof createInvoiceMessageInputSchema>;
export type InvoiceMessageRecipient = z.infer<typeof invoiceMessageRecipientSchema>;

export function assertInvoiceMessageEventType(eventType: InvoiceMessageEventType): void {
  switch (eventType) {
    case "send":
    case "close":
    case "draft":
    case "re-open":
      return;
    default: {
      const exhaustive: never = eventType;
      throw new Error(`Unsupported invoice message event_type: ${String(exhaustive)}`);
    }
  }
}

export function buildCreateInvoiceMessageBody(input: CreateInvoiceMessageInput): Record<string, unknown> {
  if (input.event_type !== undefined) {
    assertInvoiceMessageEventType(input.event_type);
  } else {
    const hasRecipients = (input.recipients?.length ?? 0) > 0;
    if (!hasRecipients && input.send_me_a_copy !== true) {
      throw new Error(
        "Sending an invoice email (omit event_type) requires recipients[] and/or send_me_a_copy=true. Use event_type=send to mark a draft as sent without emailing.",
      );
    }
  }

  const body: Record<string, unknown> = {};
  if (input.event_type !== undefined) {
    body.event_type = input.event_type;
  }
  if (input.recipients !== undefined) {
    body.recipients = input.recipients.map((recipient) => {
      const item: Record<string, unknown> = { email: recipient.email };
      if (recipient.name !== undefined) {
        item.name = recipient.name;
      }
      return item;
    });
  }
  if (input.subject !== undefined) {
    body.subject = input.subject;
  }
  if (input.body !== undefined) {
    body.body = input.body;
  }
  if (input.attach_pdf !== undefined) {
    body.attach_pdf = input.attach_pdf;
  }
  if (input.send_me_a_copy !== undefined) {
    body.send_me_a_copy = input.send_me_a_copy;
  }
  if (input.thank_you !== undefined) {
    body.thank_you = input.thank_you;
  }
  if (input.include_link_to_client_invoice !== undefined) {
    body.include_link_to_client_invoice = input.include_link_to_client_invoice;
  }
  return body;
}

export async function listInvoiceMessages(
  client: HarvestClient,
  input: z.infer<typeof listInvoiceMessagesInputSchema>,
): Promise<unknown> {
  return client.request({
    method: "GET",
    path: `/invoices/${input.invoice_id}/messages`,
    query: {
      updated_since: input.updated_since,
      page: input.page,
      per_page: input.per_page,
    },
  });
}

export function isGatedInvoiceSend(input: CreateInvoiceMessageInput): boolean {
  return input.event_type === undefined || input.event_type === "send";
}

export async function createInvoiceMessage(
  client: HarvestClient,
  input: CreateInvoiceMessageInput,
  env: NodeJS.ProcessEnv = process.env,
): Promise<unknown> {
  if (isGatedInvoiceSend(input)) {
    const action =
      input.event_type === "send"
        ? "create_invoice_message event_type=send"
        : "create_invoice_message email send (omit event_type)";
    assertDangerousSendAllowed(action, env);
  }
  return client.request({
    method: "POST",
    path: `/invoices/${input.invoice_id}/messages`,
    body: buildCreateInvoiceMessageBody(input),
  });
}

export async function previewInvoiceMessage(
  client: HarvestClient,
  input: z.infer<typeof previewInvoiceMessageInputSchema>,
): Promise<unknown> {
  return client.request({
    method: "GET",
    path: `/invoices/${input.invoice_id}/messages/new`,
    query: {
      thank_you: input.thank_you,
      reminder: input.reminder,
    },
  });
}

export async function deleteInvoiceMessage(client: HarvestClient, invoiceId: number, messageId: number): Promise<unknown> {
  return client.request({
    method: "DELETE",
    path: `/invoices/${invoiceId}/messages/${messageId}`,
  });
}
