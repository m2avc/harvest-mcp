# harvest-mcp

Agent Plugin that connects [Harvest](https://www.getharvest.com/) through **Harvest’s official remote MCP** at `https://api.harvestapp.com/mcp` (`streamable-http`).

This package does **not** reimplement the Harvest REST API. It points Cursor / Agent hosts at Harvest’s hosted MCP and ships public-safe skills so agents cover **all official Harvest MCP tools (35)**.

## Install

1. Install this plugin (Marketplace, cursor.directory, or local `~/.cursor/plugins/local/harvest-mcp`).
2. Complete Harvest **OAuth** when the host prompts you. Do not paste personal access tokens into chat or into this repo.
3. Reload / reconnect MCP if tools do not appear.

Manual Cursor `mcp.json` equivalent (no plugin):

```json
{
  "mcpServers": {
    "harvest": {
      "url": "https://api.harvestapp.com/mcp"
    }
  }
}
```

Plugin `mcp.json` uses Agent Plugins schema with explicit `type: "streamable-http"`.

## Domain shapes (for agents)

- `TimeEntry = { id, project, task, hours, notes, spent_date, is_running }`
- `Project = { id, name, client, code, is_active, billing }`
- `Client = { id, name, is_active }`
- `Task = { id, name, billable_by_default }`
- `Expense = { id, project, category, spent_date, total_cost, notes }`
- `Invoice = { id, client, state, line_items, amounts }` — MCP creates **drafts only**; send from the Harvest app.

## Skills

| Skill | When |
| --- | --- |
| `use-harvest-mcp` | Before calling Harvest tools; auth, permissions, full **35-tool map**, draft-invoice lock, gaps |
| `harvest-timers-and-time` | Start/stop timers, log past time, list/edit/delete entries, time reports |
| `harvest-projects-clients-tasks` | Clients, projects, tasks, budgets, team assignments |
| `harvest-expenses` | Expense categories, list/get/create/update expenses |
| `harvest-draft-invoices` | List/get invoices; create **draft** invoices (including from tracked time) — never send |

## Official tool coverage (35)

Account: `get_account_settings`, `submit_feedback`

Timers/time: `start_timer`, `stop_timer`, `get_running_timer`, `log_time`, `list_time_entries`, `update_time_entry`, `delete_time_entry`, `get_time_report`

Projects/clients/tasks: `list_clients`, `create_client`, `update_client`, `list_projects`, `create_project`, `update_project`, `get_project_budget`, `list_tasks`, `create_task`, `update_task`, `add_task_to_project`, `remove_task_from_project`

Team: `list_users`, `list_project_assignments`, `assign_user_to_project`, `unassign_user_from_project`

Expenses: `list_expense_categories`, `list_expenses`, `get_expense`, `create_expense`, `update_expense`

Invoices: `list_invoices`, `get_invoice`, `create_invoice`, `create_invoice_from_tracked_time`

See `skills/use-harvest-mcp/SKILL.md` for the full map and gaps.

## What this is / isn’t

| | |
| --- | --- |
| **Is** | Packaging of Harvest Inc’s official MCP URL + public-safe usage skills |
| **Isn’t** | A Cursor Marketplace “official Harvest” listing by Harvest Inc |
| **Isn’t** | A custom REST/stdio reimplementation |
| **Isn’t** | Company-specific invoicing procedures or private client data |

## Auth

OAuth through the MCP host. Never commit tokens or Account IDs.

## Author

M2 AV Consulting, LLC — support@m2avc.com

## License

MIT. Harvest is a trademark of its owner. This community packaging is unaffiliated with Harvest / Forecast.
