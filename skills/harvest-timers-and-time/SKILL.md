---
name: harvest-timers-and-time
description: >-
  Use when starting, stopping, or switching Harvest timers, logging past time,
  listing/updating/deleting time entries, or pulling time reports via Harvest MCP.
---
# Harvest timers and time entries

Requires the Harvest MCP (`use-harvest-mcp` for auth, permissions, and draft-invoice rules).

## Tools in this skill

`start_timer`, `stop_timer`, `get_running_timer`, `log_time`, `list_time_entries`, `update_time_entry`, `delete_time_entry`, `get_time_report`

Related (resolve IDs first): `list_projects`, `list_tasks`, `list_project_assignments`, `get_project_budget`

## Intents → tools

| Intent | Tool |
| --- | --- |
| What’s running? | `get_running_timer` |
| Start work | `start_timer` on project + task; optional notes |
| Stop / finish | `stop_timer` |
| Log known duration | `log_time` with hours (past / non-running) |
| Review a range | `list_time_entries` with date filters (`from` / `to` as supported) |
| Fix an entry | `update_time_entry` (hours, notes, project, task, date) |
| Remove a mistake | `delete_time_entry` only with clear user intent |
| Range totals | `get_time_report` (group by project, client, or user) |
| Budget usage | `get_project_budget` (projects skill; often paired with reports) |

Resolve project and task with `list_projects` / `list_tasks` / `list_project_assignments` before guessing IDs.

## Workflow tips

1. Check `get_running_timer` before starting another timer if the user might already be tracking.
2. Prefer stopping the current timer before starting a different project/task unless the user asked to switch and the host/tool flow supports it cleanly.
3. Write client-safe notes: clear, grammatical, no internal chatter.
4. Prefer appending clarifying detail over silently overwriting notes unless the user asked to rewrite.
5. Confirm briefly after each action: project, task, running/stopped, hours if stopped, short note snippet.

## Do not

- Start/stop/switch without clear user intent
- Log time for automation/bot activity as the user’s work
- Invent hours when the tool errors — report the failure
- Delete entries without explicit confirmation of intent
