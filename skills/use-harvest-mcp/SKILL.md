---
name: use-harvest-mcp
description: >-
  Use before calling Harvest MCP tools, when connecting Harvest, or when unsure
  whether an action is allowed (auth, permissions, draft invoices, known gaps).
  Includes the full official Harvest MCP tool map.
---
# Use Harvest MCP

## Connect

This plugin’s `mcp.json` points at Harvest’s official remote MCP:

`https://api.harvestapp.com/mcp` (`streamable-http`)

Authenticate with **OAuth** in the host UI when prompted. Never ask the user to paste a personal access token, Account ID, or other secrets into chat or into this repo.

## Domain shapes

Organize work around what tools return (do not invent values):

- `TimeEntry = { id, project, task, hours, notes, spent_date, is_running }`
- `Project = { id, name, client, code, is_active, billing }`
- `Client = { id, name, is_active }`
- `Task = { id, name, billable_by_default }`
- `Expense = { id, project, category, spent_date, total_cost, notes }`
- `Invoice = { id, client, state, line_items, amounts }`

Call tools and report what they return. Do not invent IDs, hours, or invoice totals.

## Permissions

The MCP acts as the **signed-in Harvest user**. Capability follows that user’s Harvest role:

- Admins/managers may list or edit team time, projects, and assignments when Harvest allows it.
- Otherwise stick to the authenticated user’s own entries, timers, and expenses.
- If a tool fails with a permission error, report it clearly; do not retry with fabricated elevated access.

## Invoices (hard rule — draft only)

Harvest MCP **creates draft invoices only**. Reviewing, approving, and **sending** happen in the Harvest app.

- Use `create_invoice` / `create_invoice_from_tracked_time` only to produce drafts.
- Never claim an invoice was sent unless the user confirmed they sent it in Harvest.
- Prefer the `harvest-draft-invoices` skill for invoice workflows.

## Full official tool map (35)

Every tool below is part of Harvest’s official remote MCP surface covered by this plugin’s skills.

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

### Team (4)

| Tool | Intent |
| --- | --- |
| `list_users` | List users in the account |
| `list_project_assignments` | List who is assigned to projects |
| `assign_user_to_project` | Assign a user to a project |
| `unassign_user_from_project` | Remove a user from a project |

Skill: `harvest-projects-clients-tasks` (team section)

### Expenses (5)

| Tool | Intent |
| --- | --- |
| `list_expense_categories` | List expense categories |
| `list_expenses` | List expenses |
| `get_expense` | Get one expense |
| `create_expense` | Create an expense |
| `update_expense` | Update an expense |

Skill: `harvest-expenses`

### Invoices (4)

| Tool | Intent |
| --- | --- |
| `list_invoices` | List invoices |
| `get_invoice` | Get one invoice |
| `create_invoice` | Create a **draft** invoice |
| `create_invoice_from_tracked_time` | Create a **draft** from tracked time |

Skill: `harvest-draft-invoices`

**Count check:** 2 + 8 + 12 + 4 + 5 + 4 = **35**.

## Known gaps

As of Harvest’s public MCP documentation / help center:

- Invoice **payment** records and invoice **PDF** links are not exposed on the MCP. Use the Harvest REST API or the Harvest UI for those.
- **Sending** invoices is not available via MCP — draft only.
- If a needed capability is missing, use `submit_feedback` rather than inventing a workaround that mutates data incorrectly.

## Do not

- Paste secrets (tokens, Account IDs) into chat or commit them
- Send invoices via MCP (not supported)
- Fabricate time, expense, or invoice data when a tool fails
- Thin coverage — prefer the mapped official tool for the user’s intent
