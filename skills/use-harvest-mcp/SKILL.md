---
name: use-harvest-mcp
description: >-
  Use before calling Harvest MCP tools, when connecting Harvest, or when unsure
  whether an action is allowed (auth, permissions, invoice send, known gaps).
  Covers the official 35-tool remote MCP and this plugin’s harvest-rest server.
---
# Use Harvest MCP

## Connect

This plugin ships **two** MCP servers:

| Server | Transport | Auth |
| --- | --- | --- |
| `harvest` | Official remote `https://api.harvestapp.com/mcp` (`streamable-http`) | Host OAuth |
| `harvest-rest` | Local stdio (`servers/harvest-rest`) | `HARVEST_ACCESS_TOKEN` + `HARVEST_ACCOUNT_ID` (+ optional `HARVEST_USER_AGENT`; default `m2avc-harvest-mcp/<version> (mn@m2avc.com)`) |

Never ask the user to paste a personal access token, Account ID, or other secrets into chat or into this repo. If `harvest-rest` tools fail with a config error, tell the user to set those variables in the **host environment**, not in chat.

## Domain shapes

Organize work around what tools return (do not invent values):

- `TimeEntry = { id, project, task, hours, notes, spent_date, is_running }`
- `Project = { id, name, client, code, is_active, billing }`
- `Client = { id, name, is_active }`
- `Task = { id, name, billable_by_default }`
- `Expense = { id, project, category, spent_date, total_cost, notes }`
- `Invoice = { id, client, state, line_items, amounts }`
- `InvoiceMessage = { id, event_type, recipients, subject, body }`
- `InvoicePayment = { id, amount, paid_at, paid_date, notes }`
- `BillableRate = { id, amount, start_date, end_date }`
- `UserAssignment = { id, use_default_rates, hourly_rate }`

Call tools and report what they return. Do not invent IDs, hours, or invoice totals.

## Permissions

Both servers act as the **signed-in Harvest user** (OAuth user or token owner). Capability follows that user’s Harvest role:

- Admins/managers may list or edit team time, projects, invoices, and assignments when Harvest allows it.
- Invoice messages and payments require Administrator or Manager permission to create/edit invoices (`403` otherwise).
- If a tool fails with a permission error, report it clearly; do not retry with fabricated elevated access.

## Invoices

Official remote MCP **creates and reads draft invoices** (`create_invoice`, `create_invoice_from_tracked_time`, `list_invoices`, `get_invoice`). It cannot update, delete, send, or record payments.

**Sending and state changes** are on `harvest-rest` via `create_invoice_message`:

| `event_type` | Effect |
| --- | --- |
| omitted | Email the invoice. Requires `recipients[]` and/or `send_me_a_copy=true`. |
| `send` | Mark a **draft** as sent. Does **not** email. |
| `close` | Write off an open invoice. |
| `draft` | Mark an open invoice as draft. |
| `re-open` | Re-open a closed invoice. |

Use `preview_invoice_message` (`GET .../messages/new`) to fetch Harvest’s configured subject/body without sending.

- After `create_invoice` / `create_invoice_from_tracked_time`, the invoice is still a **draft** until a message tool succeeds.
- Email send (omit `event_type`) and `event_type=send` require host `DANGEROUS_SEND=1` and Mike GO. Without that flag the tool errors; do not work around it. CoS smoke is throwaway draft + payment notes only — no send.
- Never claim an invoice was sent, emailed, closed, or paid unless the corresponding `harvest-rest` tool succeeded.
- Prefer the `harvest-invoices` skill for invoice workflows.

## Full official tool map (35)

Every tool below is part of Harvest’s official remote MCP surface.

### Account (2)

| Tool | Intent |
| --- | --- |
| `get_account_settings` | Account/org settings visible to the signed-in user |
| `submit_feedback` | Send product feedback about MCP gaps or UX |

### Timers / time (8)

| Tool | Intent |
| --- | --- |
| `start_timer` | Start a running timer on a project + task |
| `stop_timer` | Stop the running timer |
| `get_running_timer` | See what is currently running |
| `log_time` | Log a known duration (past / non-running entry) |
| `list_time_entries` | List entries (filters such as date range) |
| `update_time_entry` | Edit hours, notes, project, task, date |
| `delete_time_entry` | Remove an entry (clear user intent only) |
| `get_time_report` | Time report totals (group by project, client, or user) |

Skill: `harvest-timers-and-time`

### Projects / clients / tasks (12)

| Tool | Intent |
| --- | --- |
| `list_clients` | List clients |
| `create_client` | Create a client |
| `update_client` | Update a client |
| `list_projects` | List projects |
| `create_project` | Create a project |
| `update_project` | Update a project |
| `get_project_budget` | Budget / burn for a project |
| `list_tasks` | List task templates |
| `create_task` | Create a task template |
| `update_task` | Update a task template |
| `add_task_to_project` | Attach a task to a project |
| `remove_task_from_project` | Detach a task from a project |

Skill: `harvest-projects-clients-tasks`

### Team (4 official)

| Tool | Intent |
| --- | --- |
| `list_users` | List users in the account |
| `list_project_assignments` | List who is assigned; may include `uses_default_rate` + `billable_rate` |
| `assign_user_to_project` | Assign a user (`project_id` + `user_id` only — **no rate fields**) |
| `unassign_user_from_project` | Remove a user from a project |

Skills: `harvest-projects-clients-tasks`, `harvest-rates-and-assignments`

### Expenses (5)

| Tool | Intent |
| --- | --- |
| `list_expense_categories` | List expense categories |
| `list_expenses` | List expenses |
| `get_expense` | Get one expense |
| `create_expense` | Create an expense |
| `update_expense` | Update an expense |

Skill: `harvest-expenses`

### Invoices (4 official)

| Tool | Intent |
| --- | --- |
| `list_invoices` | List invoices |
| `get_invoice` | Get one invoice |
| `create_invoice` | Create a **draft** invoice |
| `create_invoice_from_tracked_time` | Create a **draft** from tracked time |

Skill: `harvest-invoices`

**Count check:** 2 + 8 + 12 + 4 + 5 + 4 = **35**.

## harvest-rest tools (API v2)

| Tool | Intent |
| --- | --- |
| `update_invoice` | PATCH invoice headers; line items create / update / `_destroy` |
| `delete_invoice` | Delete an invoice (clear user intent) |
| `list_invoice_messages` | List messages for an invoice |
| `create_invoice_message` | Email, or `event_type` send / close / draft / re-open |
| `preview_invoice_message` | Preview subject/body (`GET .../messages/new`) |
| `delete_invoice_message` | Delete a message |
| `list_invoice_payments` | List payments |
| `create_invoice_payment` | Record a payment; **preserve `notes` verbatim** |
| `delete_invoice_payment` | Delete a payment |
| `list_contacts` | Resolve recipient name/email (`client_id` filter) |
| `list_user_billable_rates` | GET user default billable rates |
| `get_user_billable_rate` | GET one billable rate (API v2 supports retrieve) |
| `create_user_billable_rate` | POST a user billable rate |
| `update_project_user_assignment` | PATCH assignment `use_default_rates` / `uses_default_rate` + `hourly_rate` |

These four rate tools live on the **same** `servers/harvest-rest` stdio server as the invoice tools. Do not add a second stdio server.

## Known gaps

Still not on official remote MCP or this REST server (see `docs/API_V2_GAP_MATRIX.md`):

- Invoice **PDF** binary download (public client URL may still be derived from `client_key` on a retrieved invoice).
- Invoice item categories; user cost rates (P1).
- Estimates, retainers (beyond invoice `estimate_id` / `retainer_id` fields), recurring invoice admin, PTO, roles.
- If a needed capability is missing, use official `submit_feedback` rather than inventing a workaround that mutates data incorrectly.

Harvest API v2 requires `User-Agent` = integration name + author contact ([Overview](https://help.getharvest.com/api-v2/introduction/overview/general/)). General rate limit **100 / 15s**; Reports **100 / 15min**. On `429`, honor `Retry-After`.

## Do not

- Paste secrets (tokens, Account IDs) into chat or commit them
- Claim an invoice was sent, emailed, or paid without a successful tool result
- Rewrite payment `notes` (pass the user’s text character-for-character)
- Fabricate time, expense, or invoice data when a tool fails
- Thin coverage — prefer the mapped official tool for timers/projects/expenses, and `harvest-rest` for invoice mutations and rate tools listed above
- Add a second stdio REST server — extend `servers/harvest-rest` instead
