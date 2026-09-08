# harvest-mcp

![harvest-mcp](assets/logo.svg)

Agent Plugin that connects [Harvest](https://www.getharvest.com/) through:

1. **Harvest’s official remote MCP** at `https://api.harvestapp.com/mcp` (`streamable-http`) — OAuth, 35 tools.
2. **This plugin’s `harvest-rest` stdio server** — Harvest API v2 invoice update/delete, invoice messages (including send), invoice payments, and a minimal contacts list for recipients.

This is community packaging by M2 AV Consulting, LLC. It is **not** an official Harvest Inc listing.

## Install

1. Install this plugin (Marketplace, cursor.directory, or local `~/.cursor/plugins/local/harvest-mcp`).
2. Complete Harvest **OAuth** when the host prompts you for the official remote MCP. Do not paste personal access tokens into chat or into this repo.
3. For **invoice update / send / payments**, set these environment variables on the host (inherited by the stdio server). Do not put secrets in `mcp.json` (that file is public package data):

   - `HARVEST_ACCESS_TOKEN` — Harvest personal access token or OAuth access token
   - `HARVEST_ACCOUNT_ID` — numeric Harvest account ID
   - `HARVEST_USER_AGENT` — optional; defaults to `m2avc-harvest-mcp (support@m2avc.com)`

4. Node.js 18+ is required to run `harvest-rest`. Reload / reconnect MCP if tools do not appear.

Manual Cursor `mcp.json` equivalent (no plugin). Tokens stay in your local host env, not in the file:

```json
{
  "mcpServers": {
    "harvest": {
      "url": "https://api.harvestapp.com/mcp"
    },
    "harvest-rest": {
      "command": "node",
      "args": ["./servers/harvest-rest/dist/index.js"]
    }
  }
}
```

Plugin `mcp.json` uses Agent Plugins schema (`streamable-http` + `stdio`).

## Domain shapes (for agents)

- `TimeEntry = { id, project, task, hours, notes, spent_date, is_running }`
- `Project = { id, name, client, code, is_active, billing }`
- `Client = { id, name, is_active }`
- `Task = { id, name, billable_by_default }`
- `Expense = { id, project, category, spent_date, total_cost, notes }`
- `Invoice = { id, client, state, line_items, amounts }`
- `InvoiceMessage = { id, event_type, recipients, subject, body }`
- `InvoicePayment = { id, amount, paid_at, paid_date, notes }`

Official MCP **creates drafts**. Sending, closing, reopening, updating, deleting, and recording payments are on **harvest-rest**. Never claim an invoice was sent unless `create_invoice_message` succeeded.

## Skills

| Skill | When |
| --- | --- |
| `use-harvest-mcp` | Before calling Harvest tools; auth, two-server map, invoice send rules, gaps |
| `harvest-timers-and-time` | Start/stop timers, log past time, list/edit/delete entries, time reports |
| `harvest-projects-clients-tasks` | Clients, projects, tasks, budgets, team assignments |
| `harvest-expenses` | Expense categories, list/get/create/update expenses |
| `harvest-invoices` | List/get/create drafts (official MCP); update/delete, messages, payments (`harvest-rest`) |

## Official remote MCP tools (35)

Account: `get_account_settings`, `submit_feedback`

Timers/time: `start_timer`, `stop_timer`, `get_running_timer`, `log_time`, `list_time_entries`, `update_time_entry`, `delete_time_entry`, `get_time_report`

Projects/clients/tasks: `list_clients`, `create_client`, `update_client`, `list_projects`, `create_project`, `update_project`, `get_project_budget`, `list_tasks`, `create_task`, `update_task`, `add_task_to_project`, `remove_task_from_project`

Team: `list_users`, `list_project_assignments`, `assign_user_to_project`, `unassign_user_from_project`

Expenses: `list_expense_categories`, `list_expenses`, `get_expense`, `create_expense`, `update_expense`

Invoices: `list_invoices`, `get_invoice`, `create_invoice`, `create_invoice_from_tracked_time`

## harvest-rest tools (API v2)

| Tool | Harvest endpoint |
| --- | --- |
| `update_invoice` | `PATCH /v2/invoices/{INVOICE_ID}` (line items: create / update / `_destroy`) |
| `delete_invoice` | `DELETE /v2/invoices/{INVOICE_ID}` |
| `list_invoice_messages` | `GET /v2/invoices/{INVOICE_ID}/messages` |
| `create_invoice_message` | `POST /v2/invoices/{INVOICE_ID}/messages` (`event_type`: send \| close \| draft \| re-open, or omit to email) |
| `preview_invoice_message` | `GET /v2/invoices/{INVOICE_ID}/messages/new` |
| `delete_invoice_message` | `DELETE /v2/invoices/{INVOICE_ID}/messages/{MESSAGE_ID}` |
| `list_invoice_payments` | `GET /v2/invoices/{INVOICE_ID}/payments` |
| `create_invoice_payment` | `POST /v2/invoices/{INVOICE_ID}/payments` (notes preserved verbatim) |
| `delete_invoice_payment` | `DELETE /v2/invoices/{INVOICE_ID}/payments/{PAYMENT_ID}` |
| `list_contacts` | `GET /v2/contacts` (recipient lookup only) |

See `skills/use-harvest-mcp/SKILL.md` for the full map and remaining gaps.

## What this is / isn’t

| | |
| --- | --- |
| **Is** | Official Harvest MCP URL + a small REST stdio server for documented API v2 invoice gaps |
| **Isn’t** | A Cursor Marketplace “official Harvest” listing by Harvest Inc |
| **Isn’t** | A full Harvest REST reimplementation (timers, projects, expenses stay on the official MCP) |
| **Isn’t** | Company-specific invoicing procedures or private client data |

## Auth

- Official remote MCP: OAuth through the MCP host.
- `harvest-rest`: `HARVEST_ACCESS_TOKEN` + `HARVEST_ACCOUNT_ID` + `User-Agent` header. Never commit tokens or Account IDs.

## Extending the REST server

Further official-MCP gaps (for example billable rates) should be added to `servers/harvest-rest/` — one stdio entrypoint — not a second server package.

## Author

M2 AV Consulting, LLC — support@m2avc.com

## License

MIT. Harvest is a trademark of its owner. This community packaging is unaffiliated with Harvest / Forecast.
