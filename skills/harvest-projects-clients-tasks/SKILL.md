---
name: harvest-projects-clients-tasks
description: >-
  Use when listing or managing Harvest clients, projects, tasks, project budgets,
  or team project assignments via the Harvest MCP.
---
# Harvest projects, clients, tasks, and team

Requires the Harvest MCP (`use-harvest-mcp` for auth and permissions).

## Tools in this skill

**Clients / projects / tasks:** `list_clients`, `create_client`, `update_client`, `list_projects`, `create_project`, `update_project`, `get_project_budget`, `list_tasks`, `create_task`, `update_task`, `add_task_to_project`, `remove_task_from_project`

**Team (official MCP):** `list_users`, `list_project_assignments`, `assign_user_to_project`, `unassign_user_from_project`

**Assignment rates (same harvest-rest stdio server):** `update_project_user_assignment` — official create/assign cannot set `use_default_rates` / `hourly_rate`. See `harvest-rates-and-assignments`.

## Intents → tools

| Intent | Tool |
| --- | --- |
| Find a client | `list_clients` |
| Add / edit client | `create_client` / `update_client` |
| Find a project | `list_projects` |
| Add / edit project | `create_project` / `update_project` |
| Budget / burn | `get_project_budget` |
| Task templates | `list_tasks`, `create_task`, `update_task` |
| Attach task to project | `add_task_to_project` |
| Detach task from project | `remove_task_from_project` |
| Who’s on the account | `list_users` |
| Who’s on projects | `list_project_assignments` |
| Assign / unassign | `assign_user_to_project` / `unassign_user_from_project` (official; ids only) |
| Set assignment hourly rate | `update_project_user_assignment` on **harvest-rest** — **only** when the user explicitly requests **and** confirms a rate change (`use_default_rates` / `uses_default_rate` + `hourly_rate`) |

## Workflow tips

1. Resolve clients before creating projects; resolve projects/tasks before timers or expenses.
2. Prefer listing existing records and matching by name/code from tool results over inventing IDs.
3. Mutating creates/updates/assignments only with clear user intent; summarize what will change first when the request is ambiguous.
4. Budget questions: call `get_project_budget` and report returned figures; do not estimate from memory.
5. Team changes may require admin/manager permissions — if denied, say so and stop.
6. Official `assign_user_to_project` accepts only `project_id` + `user_id`. Call harvest-rest `update_project_user_assignment` **only** when the user explicitly requests a rate change **and** confirms it. Use the **user assignment id** with `use_default_rates` / `uses_default_rate` and `hourly_rate`. Do not change rates as a side effect of assigning.

## Do not

- Guess project, client, task, or user IDs
- Create duplicate clients/projects when a close match already exists without asking
- Unassign users or remove tasks without clear intent
- Change assignment rates (`update_project_user_assignment`) unless the user explicitly requested and confirmed the rate change
