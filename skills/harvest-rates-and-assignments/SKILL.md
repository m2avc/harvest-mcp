---
name: harvest-rates-and-assignments
description: >-
  Use when listing, fetching, or creating Harvest user billable rates, or when
  setting a project assignment's use_default_rates / hourly_rate. Official
  Harvest MCP cannot do these; they live on the single harvest-rest stdio server.
---
# Harvest billable rates and assignment rates

Requires `use-harvest-mcp`. These tools are on **harvest-rest** (`servers/harvest-rest` — the same stdio server as invoice REST tools), not a second server.

Docs:

- [User billable rates](https://help.getharvest.com/api-v2/users-api/users/billable-rates/)
- [Project user assignments](https://help.getharvest.com/api-v2/projects-api/projects/user-assignments/)

## Auth (harvest-rest)

Host env only — do not paste tokens into chat:

- `HARVEST_ACCESS_TOKEN` → `Authorization: Bearer …`
- `HARVEST_ACCOUNT_ID` → `Harvest-Account-Id`
- `HARVEST_USER_AGENT` → `User-Agent` (default `m2avc-harvest-mcp/<semver> (mn@m2avc.com)` from root `package.json`; integration author contact)

Official remote MCP OAuth does **not** authenticate harvest-rest. CoS connect steps: `servers/harvest-rest/COS-RUNBOOK.md`.

## Tools

| Tool | HTTP |
| --- | --- |
| `list_user_billable_rates` | `GET /v2/users/{user_id}/billable_rates` |
| `get_user_billable_rate` | `GET /v2/users/{user_id}/billable_rates/{billable_rate_id}` (API v2 supports retrieve) |
| `create_user_billable_rate` | `POST /v2/users/{user_id}/billable_rates` |
| `update_project_user_assignment` | `PATCH /v2/projects/{project_id}/user_assignments/{user_assignment_id}` |

## Assignment rates (create vs update)

- Official `assign_user_to_project` — `project_id` + `user_id` only.
- Then harvest-rest `update_project_user_assignment` for `use_default_rates` / alias `uses_default_rate` + `hourly_rate`.
- Official `list_project_assignments` is the read path (`uses_default_rate`, `billable_rate`).

## Suggested live smoke (Harvest CoS)

Read-only unless asked to change a rate. Do **not** send invoices or client invoice emails.

1. Operator-supplied user id — `list_user_billable_rates`. Current default (`end_date` null) amount should match the operator-supplied expected amount.
2. Operator-supplied user id — assignment rates via official `list_project_assignments`. Report returned fields; do not invent project or client names.

## Do not

- Paste tokens or account ids into chat
- Treat official `assign_user_to_project` as able to set hourly rates
- Add a second stdio REST server
- Invent invoice-send or payment-email workarounds here
