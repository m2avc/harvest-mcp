---
name: harvest-expenses
description: >-
  Use when listing expense categories, listing or fetching expenses, or
  creating/updating expenses via the Harvest MCP.
---
# Harvest expenses

Requires the Harvest MCP (`use-harvest-mcp` for auth and permissions).

## Tools in this skill

`list_expense_categories`, `list_expenses`, `get_expense`, `create_expense`, `update_expense`

Related: `list_projects` (resolve project before creating an expense)

## Intents → tools

| Intent | Tool |
| --- | --- |
| What categories exist? | `list_expense_categories` |
| Review expenses | `list_expenses` (filters as supported) |
| One expense detail | `get_expense` |
| Log a new expense | `create_expense` (project, category, date, amount/notes as required) |
| Fix an expense | `update_expense` |

## Workflow tips

1. Call `list_expense_categories` before creating if the category is unclear.
2. Resolve the project with `list_projects` (or assignments) before `create_expense`.
3. Confirm amount, date, project, category, and notes after create/update.
4. Do not invent receipt URLs or costs when the tool fails — report the error.

## Do not

- Create expenses without clear user intent and amount/date context
- Fabricate category or project IDs
- Claim reimbursement status the MCP did not return
