# Harvest API v2 gap matrix

Scraped **2026-09-08** from [https://help.getharvest.com/api-v2/](https://help.getharvest.com/api-v2/) via HTTP fetch of HTML (no browser, no screenshots).

This matrix compares every documented v2 page/endpoint/behavior against:

1. **Official remote MCP** — `https://api.harvestapp.com/mcp` (35 tools; OAuth).
2. **harvest-rest** — this plugin’s single stdio server (`servers/harvest-rest`).
3. **Marketplace packaging** — `plugin.json`, `mcp.json`, skills, env, User-Agent.

Do **not** implement every missing domain endpoint in the P0 reliability PR. Use the **Priority** and **Status** columns.

| Priority | Meaning |
| --- | --- |
| **P0** | Client reliability (headers, User-Agent, 429 `Retry-After`, error surfacing, docs). This PR. |
| **P1** | Highest-value official-MCP gaps still missing from harvest-rest (invoice item categories, user cost rates). Follow-up draft. |
| **P2** | Remaining documented endpoints (estimates, PTO, roles, leftover CRUD, extra reports). Later drafts. |

| Status | Meaning |
| --- | --- |
| `done` | Implemented on harvest-rest and/or official MCP as noted |
| `partial` | Some methods or fields only |
| `todo` | Not implemented; backlog |
| `n/a` | Docs-only page, or not a harvest-rest concern (official MCP / Harvest ID OAuth) |

`DANGEROUS_SEND` stays **unset by default**. No live client invoice emails in tests.

---

## Documentation pages covered

Every Intro subpage and every API section listed on the v2 help root.

### 1. API Introduction

| Page | URL | Status |
| --- | --- | --- |
| Help root | https://help.getharvest.com/api-v2/ | done (inventory source) |
| Introduction index | https://help.getharvest.com/api-v2/introduction/ | done |
| Overview / general | https://help.getharvest.com/api-v2/introduction/overview/general/ | P0 done (headers, UA, errors, rate limits) |
| Pagination | https://help.getharvest.com/api-v2/introduction/overview/pagination/ | P2 todo (pass through `links`; do not auto-follow yet) |
| Code samples | https://help.getharvest.com/api-v2/introduction/overview/code-samples/ | n/a (samples only) |
| Postman collection | https://help.getharvest.com/api-v2/introduction/overview/postman-collection/ | n/a |
| Supported currencies | https://help.getharvest.com/api-v2/introduction/overview/supported-currencies/ | n/a (reference list) |
| Supported time zones | https://help.getharvest.com/api-v2/introduction/overview/supported-timezones/ | n/a (reference list) |

### 2. Authentication

| Page | URL | Status |
| --- | --- | --- |
| Authentication | https://help.getharvest.com/api-v2/authentication-api/authentication/authentication/ | partial — see Auth table |

### 3–14. Domain APIs

| Section | Pages fetched |
| --- | --- |
| Clients | [clients](https://help.getharvest.com/api-v2/clients-api/clients/clients/), [contacts](https://help.getharvest.com/api-v2/clients-api/clients/contacts/) |
| Company Settings | [company](https://help.getharvest.com/api-v2/company-api/company/company/) |
| Invoices | [invoices](https://help.getharvest.com/api-v2/invoices-api/invoices/invoices/), [messages](https://help.getharvest.com/api-v2/invoices-api/invoices/invoice-messages/), [payments](https://help.getharvest.com/api-v2/invoices-api/invoices/invoice-payments/), [item categories](https://help.getharvest.com/api-v2/invoices-api/invoices/invoice-item-categories/) |
| Estimates | [estimates](https://help.getharvest.com/api-v2/estimates-api/estimates/estimates/), [messages](https://help.getharvest.com/api-v2/estimates-api/estimates/estimate-messages/), [item categories](https://help.getharvest.com/api-v2/estimates-api/estimates/estimate-item-categories/) |
| Expenses | [expenses](https://help.getharvest.com/api-v2/expenses-api/expenses/expenses/), [categories](https://help.getharvest.com/api-v2/expenses-api/expenses/expense-categories/) |
| Tasks | [tasks](https://help.getharvest.com/api-v2/tasks-api/tasks/tasks/) |
| Timesheets | [time entries](https://help.getharvest.com/api-v2/timesheets-api/timesheets/time-entries/) |
| Projects | [projects](https://help.getharvest.com/api-v2/projects-api/projects/projects/), [user assignments](https://help.getharvest.com/api-v2/projects-api/projects/user-assignments/), [task assignments](https://help.getharvest.com/api-v2/projects-api/projects/task-assignments/) |
| Roles | [roles](https://help.getharvest.com/api-v2/roles-api/roles/roles/) |
| Users | [users](https://help.getharvest.com/api-v2/users-api/users/users/), [billable rates](https://help.getharvest.com/api-v2/users-api/users/billable-rates/), [cost rates](https://help.getharvest.com/api-v2/users-api/users/cost-rates/), [teammates](https://help.getharvest.com/api-v2/users-api/users/teammates/), [project assignments](https://help.getharvest.com/api-v2/users-api/users/project-assignments/) |
| Reports | [time](https://help.getharvest.com/api-v2/reports-api/reports/time-reports/), [expenses](https://help.getharvest.com/api-v2/reports-api/reports/expense-reports/), [uninvoiced](https://help.getharvest.com/api-v2/reports-api/reports/uninvoiced-report/), [project budget](https://help.getharvest.com/api-v2/reports-api/reports/project-budget-report/) |
| Paid Time Off | [assignments/allocations](https://help.getharvest.com/api-v2/pto-api/pto/assignments-and-allocations/), [holiday calendars](https://help.getharvest.com/api-v2/pto-api/pto/holiday-calendars/), [balances](https://help.getharvest.com/api-v2/pto-api/pto/time-off-balances/), [policies](https://help.getharvest.com/api-v2/pto-api/pto/time-off-policies/), [requests](https://help.getharvest.com/api-v2/pto-api/pto/time-off-requests/), [work schedules](https://help.getharvest.com/api-v2/pto-api/pto/work-schedules/) |

---

## Cross-cutting behaviors

Cited from [Overview](https://help.getharvest.com/api-v2/introduction/overview/general/) and [Pagination](https://help.getharvest.com/api-v2/introduction/overview/pagination/).

| Behavior | Harvest rule | harvest-rest | Official MCP | Priority | Status |
| --- | --- | --- | --- | --- | --- |
| Base URL | `https://api.harvestapp.com/v2` | Default `HARVEST_API_BASE` | Remote MCP | P0 | done |
| Methods | GET, POST, PATCH, DELETE | Same | Opaque tools | P0 | done |
| GET params | Query string only | `query` → `URLSearchParams` | n/a | P0 | done |
| POST/PATCH params | JSON body **or** form data; JSON requires `Content-Type: application/json` | JSON + `Content-Type` when body present | n/a | P0 | done |
| `Authorization` | `Bearer $ACCESS_TOKEN` (header preferred; query-string token also documented — **do not use**, URLs get logged) | Header only | Host OAuth | P0 | done |
| `Harvest-Account-Id` | Required for API v2 (PAT can access multiple accounts) | Required env | OAuth session | P0 | done |
| `User-Agent` | **Required**: application name **+** link **or** email. Contact is the **integration author**, not the end customer. Missing UA → **400**. | Default `m2avc-harvest-mcp/<semver> (mn@m2avc.com)` — `<semver>` from root `package.json` (Mike-locked). Override `HARVEST_USER_AGENT`. Never derived from end-user Harvest email/company. | Unknown (Harvest-hosted) | P0 | done |
| `Accept` | Responses are JSON | Sends `Accept: application/json` | n/a | P0 | done |
| 200 / 201 | Success / created | Parsed JSON (empty body → `{ ok, status }`) | n/a | P0 | done |
| 400 | Bad request (incl. missing UA) | `HarvestApiError` + hint | n/a | P0 | done |
| 403 | Found but not authorized | `HarvestApiError` + hint | n/a | P0 | done |
| 404 | Not found | `HarvestApiError` + hint | n/a | P0 | done |
| 422 | Validation; inspect body (`message` / `errors`) | Surfaces `message`, `error`, or `errors` JSON | n/a | P0 | done |
| 429 | Throttled; **`Retry-After`** = seconds until lift (RFC 2616) | Client retries when wait ≤ 30s; otherwise throws with `retryAfterSeconds` | Unknown | P0 | done |
| 500 | Server error | `HarvestApiError` + hint | n/a | P0 | done |
| Rate limit (general) | **100 requests / 15 seconds** | Documented + 429 retry | Unknown | P0 | done |
| Rate limit (Reports) | **100 requests / 15 minutes** | Documented; long `Retry-After` is **not** slept (throw + seconds) | `get_time_report` / `get_project_budget` | P0 | done (client); P2 if we add report tools |
| Caching | “Write carefully, caching when possible”; abuse may block the account | No response cache (mutating MCP tools). Agents should not hammer list/report calls. | Unknown | P2 | todo (guidance only) |
| Pagination | Follow `links.first/next/previous/last`; default `per_page` max **2000**; invalid `per_page` → 422; `page` and `cursor` mutually exclusive (`cursor` wins); `page` deprecated on some lists | List tools accept `page`/`per_page` and return Harvest JSON (`links` included). Do **not** construct next URLs. No auto-follow. | Unknown | P2 | partial |
| Query-string auth | `?access_token=&account_id=` documented | **Not implemented** (header auth only) | n/a | P0 | done (intentionally omitted) |

Mike-locked UA (2026-09-08): `m2avc-harvest-mcp/<semver> (mn@m2avc.com)`. Semver source of truth is the **repo-root** `package.json` `version`. Keep `plugin.json` and `servers/harvest-rest/package.json` versions equal. `HARVEST_USER_AGENT` still overrides. Do not derive UA from the end-user Harvest email or company.

---

## Authentication (Harvest ID)

| Item | Docs | harvest-rest | Official MCP | Priority | Status |
| --- | --- | --- | --- | --- | --- |
| Personal Access Token | Developers → Harvest ID; `Authorization: Bearer` + `Harvest-Account-Id` | `HARVEST_ACCESS_TOKEN` + `HARVEST_ACCOUNT_ID` | Not used | P0 | done |
| OAuth2 server (auth code) | `https://id.getharvest.com/oauth2/authorize?response_type=code` → `POST https://id.getharvest.com/api/v2/oauth2/token` | Not implemented (PAT/token env) | Host OAuth | n/a | n/a |
| OAuth2 client (implicit) | `response_type=token` | Not implemented | Host OAuth | n/a | n/a |
| Refresh token | `grant_type=refresh_token` | Not implemented | Host | n/a | n/a |
| Scopes | `harvest:{id}`, `forecast:{id}`, `harvest:all`, `forecast:all`, `all`; PAT has `all` | Account id is explicit env | Host | n/a | n/a |
| Accounts endpoint | `GET https://id.getharvest.com/api/v2/accounts` (Bearer + UA; **no** Account-Id) | Not a tool | Session pick | P2 | todo |

---

## Endpoint coverage

Columns: **REST** = harvest-rest tool (or “raw client only”). **MCP** = official remote tool.

### Clients

| Method | Path | REST | MCP | Priority | Status |
| --- | --- | --- | --- | --- | --- |
| GET | `/v2/clients` | — | `list_clients` | P2 | done (MCP) |
| GET | `/v2/clients/{CLIENT_ID}` | — | — | P2 | todo |
| POST | `/v2/clients` | — | `create_client` | P2 | done (MCP) |
| PATCH | `/v2/clients/{CLIENT_ID}` | — | `update_client` | P2 | done (MCP) |
| DELETE | `/v2/clients/{CLIENT_ID}` | — | — | P2 | todo |

### Client contacts

| Method | Path | REST | MCP | Priority | Status |
| --- | --- | --- | --- | --- | --- |
| GET | `/v2/contacts` | `list_contacts` (recipient lookup) | — | P0 invoices | done (REST, list only) |
| GET | `/v2/contacts/{CONTACT_ID}` | — | — | P2 | todo |
| POST | `/v2/contacts` | — | — | P2 | todo |
| PATCH | `/v2/contacts/{CONTACT_ID}` | — | — | P2 | todo |
| DELETE | `/v2/contacts/{CONTACT_ID}` | — | — | P2 | todo |

### Company settings

| Method | Path | REST | MCP | Priority | Status |
| --- | --- | --- | --- | --- | --- |
| GET | `/v2/company` | — | `get_account_settings` (likely) | P2 | done (MCP) |
| PATCH | `/v2/company` | — | — | P2 | todo |

### Invoices

Line items are **not** a separate resource: create/update/`_destroy` on `POST/PATCH /v2/invoices`. PDF is **not** a REST binary endpoint; `client_key` builds `{subdomain}.harvestapp.com/client/invoices/{CLIENT_KEY}` (append `.pdf`). `recurring_invoice_id` is a field only — no recurring-invoice admin API.

| Method | Path / behavior | REST | MCP | Priority | Status |
| --- | --- | --- | --- | --- | --- |
| GET | `/v2/invoices` | — | `list_invoices` | P2 | done (MCP) |
| GET | `/v2/invoices/{INVOICE_ID}` | — | `get_invoice` | P2 | done (MCP) |
| POST | `/v2/invoices` free-form | — | `create_invoice` | P2 | done (MCP) |
| POST | `/v2/invoices` from tracked time/expenses | — | `create_invoice_from_tracked_time` | P2 | done (MCP) |
| PATCH | `/v2/invoices/{INVOICE_ID}` + line items | `update_invoice` | — | P0 invoices | done (REST) |
| DELETE | `/v2/invoices/{INVOICE_ID}` | `delete_invoice` | — | P0 invoices | done (REST) |
| GET | `/v2/invoices/{ID}/messages` | `list_invoice_messages` | — | P0 invoices | done (REST) |
| POST | `/v2/invoices/{ID}/messages` (email / `event_type`) | `create_invoice_message` (email + `send` gated by `DANGEROUS_SEND`) | — | P0 invoices | done (REST) |
| GET | `/v2/invoices/{ID}/messages/new` | `preview_invoice_message` | — | P0 invoices | done (REST) |
| DELETE | `/v2/invoices/{ID}/messages/{MESSAGE_ID}` | `delete_invoice_message` | — | P0 invoices | done (REST) |
| GET | `/v2/invoices/{ID}/payments` | `list_invoice_payments` | — | P0 invoices | done (REST) |
| POST | `/v2/invoices/{ID}/payments` | `create_invoice_payment` (`send_thank_you` gated) | — | P0 invoices | done (REST) |
| DELETE | `/v2/invoices/{ID}/payments/{PAYMENT_ID}` | `delete_invoice_payment` | — | P0 invoices | done (REST) |
| GET | `/v2/invoice_item_categories` | `list_invoice_item_categories` | — | P1 | done (REST) |
| GET | `/v2/invoice_item_categories/{ID}` | `get_invoice_item_category` | — | P1 | done (REST) |
| POST | `/v2/invoice_item_categories` | `create_invoice_item_category` | — | P1 | done (REST) |
| PATCH | `/v2/invoice_item_categories/{ID}` | — | — | P2 | todo |
| DELETE | `/v2/invoice_item_categories/{ID}` | — | — | P2 | todo |

### Estimates

Entire domain missing from official MCP and harvest-rest.

| Method | Path | REST | MCP | Priority | Status |
| --- | --- | --- | --- | --- | --- |
| GET | `/v2/estimates` | — | — | P2 | todo |
| GET | `/v2/estimates/{ESTIMATE_ID}` | — | — | P2 | todo |
| POST | `/v2/estimates` | — | — | P2 | todo |
| PATCH | `/v2/estimates/{ESTIMATE_ID}` | — | — | P2 | todo |
| DELETE | `/v2/estimates/{ESTIMATE_ID}` | — | — | P2 | todo |
| GET | `/v2/estimates/{ID}/messages` | — | — | P2 | todo |
| POST | `/v2/estimates/{ID}/messages` | — | — | P2 | todo (gate email like invoices) |
| DELETE | `/v2/estimates/{ID}/messages/{MESSAGE_ID}` | — | — | P2 | todo |
| GET/POST/PATCH/DELETE | `/v2/estimate_item_categories` | — | — | P2 | todo |

### Expenses

| Method | Path | REST | MCP | Priority | Status |
| --- | --- | --- | --- | --- | --- |
| GET | `/v2/expenses` | — | `list_expenses` | P2 | done (MCP) |
| GET | `/v2/expenses/{EXPENSE_ID}` | — | `get_expense` | P2 | done (MCP) |
| POST | `/v2/expenses` | — | `create_expense` | P2 | done (MCP) |
| PATCH | `/v2/expenses/{EXPENSE_ID}` | — | `update_expense` | P2 | done (MCP) |
| DELETE | `/v2/expenses/{EXPENSE_ID}` | — | — | P2 | todo |
| GET | `/v2/expense_categories` | — | `list_expense_categories` | P2 | done (MCP) |
| GET | `/v2/expense_categories/{ID}` | — | — | P2 | todo |
| POST | `/v2/expense_categories` | — | — | P2 | todo |
| PATCH | `/v2/expense_categories/{ID}` | — | — | P2 | todo |
| DELETE | `/v2/expense_categories/{ID}` | — | — | P2 | todo |

### Tasks

| Method | Path | REST | MCP | Priority | Status |
| --- | --- | --- | --- | --- | --- |
| GET | `/v2/tasks` | — | `list_tasks` | P2 | done (MCP) |
| GET | `/v2/tasks/{TASK_ID}` | — | — | P2 | todo |
| POST | `/v2/tasks` | — | `create_task` | P2 | done (MCP) |
| PATCH | `/v2/tasks/{TASK_ID}` | — | `update_task` | P2 | done (MCP) |
| DELETE | `/v2/tasks/{TASK_ID}` | — | — | P2 | todo |

### Timesheets (time entries)

| Method | Path | REST | MCP | Priority | Status |
| --- | --- | --- | --- | --- | --- |
| GET | `/v2/time_entries` | — | `list_time_entries` | P2 | done (MCP) |
| GET | `/v2/time_entries/{TIME_ENTRY_ID}` | — | `get_running_timer` (running only) | P2 | partial |
| POST | `/v2/time_entries` (hours or started_time) | — | `log_time` / `start_timer` | P2 | done (MCP) |
| PATCH | `/v2/time_entries/{TIME_ENTRY_ID}` | — | `update_time_entry` | P2 | done (MCP) |
| PATCH | `/v2/time_entries/{ID}/restart` | — | `start_timer` (likely) | P2 | done (MCP) |
| PATCH | `/v2/time_entries/{ID}/stop` | — | `stop_timer` | P2 | done (MCP) |
| DELETE | `/v2/time_entries/{ID}` | — | `delete_time_entry` | P2 | done (MCP) |
| DELETE | `/v2/time_entries/{ID}/external_reference` | — | — | P2 | todo |

### Projects

| Method | Path | REST | MCP | Priority | Status |
| --- | --- | --- | --- | --- | --- |
| GET | `/v2/projects` | — | `list_projects` | P2 | done (MCP) |
| GET | `/v2/projects/{PROJECT_ID}` | — | — | P2 | todo |
| POST | `/v2/projects` | — | `create_project` | P2 | done (MCP) |
| PATCH | `/v2/projects/{PROJECT_ID}` | — | `update_project` | P2 | done (MCP) |
| DELETE | `/v2/projects/{PROJECT_ID}` | — | — | P2 | todo |

### Project user assignments

| Method | Path | REST | MCP | Priority | Status |
| --- | --- | --- | --- | --- | --- |
| GET | `/v2/user_assignments` | — | — | P2 | todo |
| GET | `/v2/projects/{ID}/user_assignments` | — | `list_project_assignments` (shape may differ) | P2 | partial (MCP) |
| GET | `/v2/projects/{ID}/user_assignments/{UA_ID}` | — | — | P2 | todo |
| POST | `/v2/projects/{ID}/user_assignments` | — | `assign_user_to_project` (`project_id` + `user_id` only) | P0 rates | partial (MCP create; no rate fields) |
| PATCH | `/v2/projects/{ID}/user_assignments/{UA_ID}` | `update_project_user_assignment` (`use_default_rates` / `hourly_rate`) | — | P0 rates | done (REST) |
| DELETE | `/v2/projects/{ID}/user_assignments/{UA_ID}` | — | `unassign_user_from_project` | P2 | done (MCP) |

### Project task assignments

| Method | Path | REST | MCP | Priority | Status |
| --- | --- | --- | --- | --- | --- |
| GET | `/v2/task_assignments` | — | — | P2 | todo |
| GET | `/v2/projects/{ID}/task_assignments` | — | — | P2 | todo |
| GET | `/v2/projects/{ID}/task_assignments/{TA_ID}` | — | — | P2 | todo |
| POST | `/v2/projects/{ID}/task_assignments` | — | `add_task_to_project` | P2 | done (MCP) |
| PATCH | `/v2/projects/{ID}/task_assignments/{TA_ID}` | — | — | P1 | todo (task hourly rate / budget) |
| DELETE | `/v2/projects/{ID}/task_assignments/{TA_ID}` | — | `remove_task_from_project` | P2 | done (MCP) |

### Roles

| Method | Path | REST | MCP | Priority | Status |
| --- | --- | --- | --- | --- | --- |
| GET | `/v2/roles` | — | — | P2 | todo |
| GET | `/v2/roles/{ROLE_ID}` | — | — | P2 | todo |
| POST | `/v2/roles` | — | — | P2 | todo |
| PATCH | `/v2/roles/{ROLE_ID}` | — | — | P2 | todo |
| DELETE | `/v2/roles/{ROLE_ID}` | — | — | P2 | todo |

### Users

| Method | Path | REST | MCP | Priority | Status |
| --- | --- | --- | --- | --- | --- |
| GET | `/v2/users` | — | `list_users` | P2 | done (MCP) |
| GET | `/v2/users/me` | — | — | P2 | todo |
| GET | `/v2/users/{USER_ID}` | — | — | P2 | todo |
| POST | `/v2/users` | — | — | P2 | todo |
| PATCH | `/v2/users/{USER_ID}` | — | — | P2 | todo |
| DELETE | `/v2/users/{USER_ID}` | — | — | P2 | todo |
| GET | `/v2/users/{USER_ID}/billable_rates` | `list_user_billable_rates` | — | P0 rates | done (REST) |
| GET | `/v2/users/{USER_ID}/billable_rates/{ID}` | `get_user_billable_rate` | — | P0 rates | done (REST) |
| POST | `/v2/users/{USER_ID}/billable_rates` | `create_user_billable_rate` | — | P0 rates | done (REST) |
| GET | `/v2/users/{USER_ID}/cost_rates` | `list_user_cost_rates` | — | P1 | done (REST) |
| GET | `/v2/users/{USER_ID}/cost_rates/{ID}` | `get_user_cost_rate` | — | P1 | done (REST) |
| POST | `/v2/users/{USER_ID}/cost_rates` | `create_user_cost_rate` | — | P1 | done (REST) |
| GET | `/v2/users/{USER_ID}/teammates` | — | — | P2 | todo |
| PATCH | `/v2/users/{USER_ID}/teammates` | — | — | P2 | todo |
| GET | `/v2/users/{USER_ID}/project_assignments` | — | `list_project_assignments` (likely `/users/me/...`) | P2 | partial (MCP) |
| GET | `/v2/users/me/project_assignments` | — | `list_project_assignments` | P2 | done (MCP) |

API v2 has **no** PATCH/DELETE for billable or cost rates (create with `start_date` rules replaces history).

### Reports (stricter throttle)

| Method | Path | REST | MCP | Priority | Status |
| --- | --- | --- | --- | --- | --- |
| GET | `/v2/reports/time/clients` | — | `get_time_report` (group) | P2 | partial (MCP) |
| GET | `/v2/reports/time/projects` | — | `get_time_report` | P2 | partial (MCP) |
| GET | `/v2/reports/time/tasks` | — | `get_time_report` | P2 | partial (MCP) |
| GET | `/v2/reports/time/team` | — | `get_time_report` | P2 | partial (MCP) |
| GET | `/v2/reports/expenses/clients` | — | — | P2 | todo |
| GET | `/v2/reports/expenses/projects` | — | — | P2 | todo |
| GET | `/v2/reports/expenses/categories` | — | — | P2 | todo |
| GET | `/v2/reports/expenses/team` | — | — | P2 | todo |
| GET | `/v2/reports/uninvoiced` | — | — | P2 | todo |
| GET | `/v2/reports/project_budget` | — | `get_project_budget` | P2 | done (MCP) |

### Paid Time Off

None of these are on official MCP or harvest-rest.

| Method | Path | Priority | Status |
| --- | --- | --- | --- |
| GET/PATCH | `/v2/pto/assignments`, `/v2/pto/assignments/{USER_ID}` | P2 | todo |
| GET/PATCH | `/v2/pto/allocations` | P2 | todo |
| CRUD | `/v2/pto/holiday_calendars` + `/entries` | P2 | todo |
| GET | `/v2/pto/balances` | P2 | todo |
| CRUD | `/v2/pto/types` | P2 | todo |
| CRUD + approve/decline/request_changes | `/v2/pto/requests` | P2 | todo |
| CRUD | `/v2/pto/work_schedules` | P2 | todo |

Official MCP also has `submit_feedback` (not a v2 REST resource).

---

## Marketplace packaging

| Item | Expected | Status |
| --- | --- | --- |
| Official remote MCP URL | `https://api.harvestapp.com/mcp` in `mcp.json` | done |
| Single stdio REST server | `servers/harvest-rest` only | done |
| Tokens not in `mcp.json` | Host env: `HARVEST_ACCESS_TOKEN`, `HARVEST_ACCOUNT_ID` | done |
| Default UA | `m2avc-harvest-mcp/<semver> (mn@m2avc.com)` from root `package.json` | P0 done |
| UA override | `HARVEST_USER_AGENT` | P0 done |
| UA not from customer identity | No dynamic email/company UA | P0 done |
| `DANGEROUS_SEND` | Default off; `1` + Mike GO for live send | done |
| Skills map 35 official tools + REST gaps | `skills/use-harvest-mcp` | done (P1 cost rates + invoice item categories listed) |

---

## P0 / P1 / P2 backlog (checkboxes)

### P0 — this PR (client reliability)

- [x] Default User-Agent `m2avc-harvest-mcp/<semver> (mn@m2avc.com)` from root `package.json`
- [x] Honor `HARVEST_USER_AGENT`
- [x] Required headers: `Authorization`, `Harvest-Account-Id`, `User-Agent`, `Accept`; `Content-Type` on JSON bodies
- [x] GET query vs POST/PATCH JSON body
- [x] 429 `Retry-After` retry in `harvest-client.ts` (not scattered)
- [x] Error surfacing for 400 / 403 / 404 / 422 / 429 / 500 (no token leak)
- [x] Docs: COS-RUNBOOK + root README cite help.getharvest.com
- [x] Unit tests: UA default, Retry-After, error mapping; no live invoice send

### P1 — follow-up draft (highest-value missing tools)

- [x] Invoice item categories: list / get / create
- [x] User cost rates: list / get / create (mirror billable rates)
- [ ] Optional: PATCH task assignment hourly rate / budget (official add-task has no rate fields) — deferred to P2

### P2 — later drafts

- [ ] Invoice item category PATCH/DELETE
- [ ] Estimates + estimate messages (gate email) + estimate item categories
- [ ] PTO (assignments, allocations, calendars, balances, types, requests, schedules)
- [ ] Roles, user teammates, `GET /v2/users/me`
- [ ] Remaining MCP CRUD gaps: delete client/project/task/expense; get-by-id
- [ ] Contacts get/create/update/delete
- [ ] Expense reports + uninvoiced report (respect 100/15min)
- [ ] Pagination helper that follows Harvest `links` (never invent `page`/`cursor`)
- [ ] `GET https://id.getharvest.com/api/v2/accounts` helper
- [ ] Company `PATCH`

---

## What this P0 PR does **not** do

- Does not add domain tools beyond those already on `feat/p0-billable-rates-assignments`.
- Does not touch or undraft invoice PR #1 or rates PR #2.
- Does not implement Harvest ID OAuth (official remote MCP already does).
- Does not send real client invoices (`DANGEROUS_SEND` remains off in tests).
