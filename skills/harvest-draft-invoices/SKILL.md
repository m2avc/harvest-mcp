---
name: harvest-draft-invoices
description: >-
  Use when listing or fetching Harvest invoices, or creating draft invoices
  (including from tracked time) via the Harvest MCP. Draft only — never send.
---
# Harvest draft invoices

Requires the Harvest MCP (`use-harvest-mcp` for auth, permissions, and the draft-only rule).

## Tools in this skill

`list_invoices`, `get_invoice`, `create_invoice`, `create_invoice_from_tracked_time`

Related: `list_clients`, `list_projects`, `list_time_entries`, `get_time_report`

## Hard rule — draft only

Harvest MCP **creates draft invoices only**. There is **no** MCP tool to send, approve, or email an invoice. Sending is done in the Harvest app by the user.

- After `create_invoice` or `create_invoice_from_tracked_time`, state that a **draft** was created.
- Never claim the invoice was sent, mailed, or charged.
- Do not invent a “send invoice” workaround.

## Intents → tools

| Intent | Tool |
| --- | --- |
| Browse invoices | `list_invoices` |
| Inspect one invoice | `get_invoice` |
| New draft (line items / structure as supported) | `create_invoice` |
| Draft from tracked time | `create_invoice_from_tracked_time` |

## Workflow tips

1. Resolve the client (and projects/time range for time-based drafts) before creating.
2. Prefer summarizing what will go on the draft and confirming with the user when amounts or ranges are ambiguous.
3. After create, report invoice id/state/amounts returned by the tool — nothing more.
4. Payment records and PDF links are **known gaps** on the MCP; use Harvest UI or REST outside this plugin for those.

## Do not

- Send, approve, or mark invoices paid via MCP
- Fabricate line items or totals when tools fail
- Imply company-specific invoicing policy beyond what the user asked in-session
