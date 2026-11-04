---
name: harvest-invoices
description: >-
  Use when listing, fetching, creating, updating, sending, closing, or deleting
  Harvest invoices, or when recording invoice payments and messages. Official
  MCP is draft create/read; send and payments are harvest-rest.
---
# Harvest invoices

Requires `use-harvest-mcp` for auth, the two-server map, and send rules.

## Which server

| Action | Server | Tools |
| --- | --- | --- |
| List / get / create draft (including from tracked time) | Official remote MCP (`harvest`) | `list_invoices`, `get_invoice`, `create_invoice`, `create_invoice_from_tracked_time` |
| Update headers or line items | `harvest-rest` | `update_invoice` |
| Delete invoice | `harvest-rest` | `delete_invoice` |
| Email, mark sent, close, draft, re-open | `harvest-rest` | `create_invoice_message` (`preview_invoice_message` first if useful) |
| List / delete messages | `harvest-rest` | `list_invoice_messages`, `delete_invoice_message` |
| List / create / delete payments | `harvest-rest` | `list_invoice_payments`, `create_invoice_payment`, `delete_invoice_payment` |
| Recipient emails | `harvest-rest` | `list_contacts` (`client_id`) |

Related: `list_clients`, `list_projects`, `list_time_entries`, `get_time_report`

## Send vs mark-as-sent

`create_invoice_message` `POST /v2/invoices/{INVOICE_ID}/messages`:

- **Omit `event_type`** to email the invoice. Include `recipients` (`email` required, `name` optional) and/or `send_me_a_copy=true`. Optional: `subject`, `body`, `attach_pdf`, `thank_you`.
- **`event_type=send`** marks a **draft** as sent. It does **not** send email. Only call when `state` is `draft`.
- **`event_type=close`** writes off an **open** invoice. Only call when `state` is `open`.
- **`event_type=draft`** marks an **open** invoice as draft. Only call when `state` is `open`.
- **`event_type=re-open`** reopens a **closed** invoice. Only call when `state` is `closed`.

`preview_invoice_message` returns Harvest’s configured subject/body (`thank_you` / `reminder` query flags) and does not create a message.

**Send gate:** omitting `event_type` (email), `event_type=send`, and payment `send_thank_you=true` are blocked unless the host has `DANGEROUS_SEND=1` **and** the call passes `confirm_live_send=true` plus a non-empty `go_ref` (short quote of Mike’s explicit GO, ≥8 characters after trim). `go_ref` is audit-only — do not expect Harvest to store it. `HARVEST_SMOKE=1`, `NODE_ENV=test`, or `HARVEST_SEND_LOCKOUT=1` refuse gated sends even then. Smoke / CoS tests use a throwaway draft + payment notes only — do not call the send path against live client invoices.

Never claim sent / emailed / closed / reopened unless the tool succeeded.

## Update line items

`update_invoice` `PATCH /v2/invoices/{INVOICE_ID}`:

- Header fields: `client_id`, `retainer_id`, `estimate_id`, `number`, `purchase_order`, `tax`, `tax2`, `discount`, `subject`, `notes`, `currency`, `issue_date`, `due_date`, `payment_term`, `payment_options`.
- `line_items`:
  - **Create:** omit `id`; include `kind` + `unit_price` (and optional `project_id`, `description`, `quantity`, `taxed`, `taxed2`).
  - **Update:** include existing `id` plus fields to change.
  - **Delete:** `{ "id": LINE_ITEM_ID, "_destroy": true }`.

Omitted fields are left unchanged.

## Payments

`create_invoice_payment` requires `amount`. Pass **either** `paid_at` **or** `paid_date`, not both. **`notes` must be forwarded character-for-character** — do not trim, rephrase, or “clean up” the user’s note.

`send_thank_you` is forced **false** by harvest-rest unless `DANGEROUS_SEND=1`, the caller sets `send_thank_you=true`, and the call also passes `confirm_live_send=true` + `go_ref` (do not inherit Harvest’s thank-you email default).

## Workflow tips

1. Resolve the client (and projects/time range for time-based drafts) before creating.
2. Confirm amounts, dates, and recipients when ambiguous.
3. Invoice mutations (`update_invoice`, `create_invoice_payment`, deletes, non-send messages) need **explicit user confirmation** before the tool call. Email / `event_type=send` / `send_thank_you` keep the stronger `DANGEROUS_SEND` + `confirm_live_send` + `go_ref` gate.
4. After any mutation, report ids/state/amounts/event_type/`notes` returned by the tool — nothing more.
5. Use `list_contacts` when the user says “send to the client’s billing contact” and you do not already have an email.

## Do not

- Claim an invoice was sent without a successful `create_invoice_message`
- Email, `event_type=send`, or `send_thank_you=true` on a live client invoice without Mike GO, `DANGEROUS_SEND=1`, `confirm_live_send=true`, and `go_ref`
- Rewrite payment notes
- Update, pay, or delete invoices/messages/payments without explicit user confirmation (`confirm=true` on deletes)
- Fabricate line items or totals when tools fail
- Imply company-specific invoicing policy beyond what the user asked in-session
