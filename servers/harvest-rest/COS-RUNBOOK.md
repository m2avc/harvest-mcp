# Harvest CoS local runbook — harvest-rest

Keep PRs **draft** until Harvest CoS smoke passes. Never email a real client invoice. Never `event_type=send` on a live client invoice without **Mike GO**.

**Mike human GO is required before Marketplace publish or a public version tag.** CoS smoke is not a publish.

This plugin is world-shared. Tokens never go in committed `mcp.json`. `DANGEROUS_SEND` stays unset unless Mike has GO'd a live send.

Do **not** set `DANGEROUS_SEND` for smoke. If the variable is inherited from a parent shell or a previous Cursor MCP env, **clear it** before starting:

```bash
unset DANGEROUS_SEND
```

Cursor users: remove `DANGEROUS_SEND` from Settings → MCP → `harvest-rest` env (or user-local `~/.cursor/mcp.json`), then **reload MCP**. Do not enable it for smoke.

## Official API v2 client rules

Cited from [Overview](https://help.getharvest.com/api-v2/introduction/overview/general/) and [Authentication](https://help.getharvest.com/api-v2/authentication-api/authentication/authentication/):

- Every request sends `Authorization: Bearer …`, `Harvest-Account-Id`, and a **User-Agent** with the **integration** name plus author contact (link or email). Missing UA → `400`. Do **not** set UA from the end customer's Harvest email or company.
- Default marketplace UA (Mike-locked): `m2avc-harvest-mcp/<semver> (mn@m2avc.com)`. **Semver** is the root `package.json` `version` (single source of truth; keep `plugin.json` and `servers/harvest-rest/package.json` equal). Override with `HARVEST_USER_AGENT` (e.g. `harvest-cos-smoke (you@example.com)`).
- Account identity is **Harvest-Account-Id + token** only.
- GET parameters go in the query string. POST/PATCH JSON bodies send `Content-Type: application/json`.
- Statuses to expect: `200`/`201` success; `400` bad request; `403` permission; `404` missing; `422` validation (`message` / `errors`); `429` throttle; `500` Harvest error.
- Rate limits: **100 requests / 15 seconds** general; **Reports 100 / 15 minutes**. On `429`, Harvest sends `Retry-After` (seconds). harvest-rest retries in `harvest-client.ts` when the wait is ≤ 30s; longer waits (typical for reports) are surfaced to the tool, not slept.
- Cache when possible; abuse can block the account. Prefer official MCP for list/report reads you already have.
- Pagination: use `links` in the JSON; do not invent `page`/`cursor` URLs. Invalid `per_page` → `422`.

Full endpoint vs tool map: [`docs/API_V2_GAP_MATRIX.md`](../../docs/API_V2_GAP_MATRIX.md).

## Auth: PAT vs OAuth (least privilege)

- Official remote MCP (`https://api.harvestapp.com/mcp`): **OAuth** through the host. Prefer this for day-to-day agent use. Scope is whatever Harvest ID grants the OAuth app / user.
- `harvest-rest`: **PAT or OAuth access token** in the **host** environment only (`HARVEST_ACCESS_TOKEN` + `HARVEST_ACCOUNT_ID`). Prefer a PAT limited to the M2 account you intend to smoke — not a production customer token pasted into chat or `mcp.json`.
- Never log tokens, Account IDs, or `Authorization` headers. Never commit them.

## Environment

Set on the **host** (Cursor MCP env or your shell). Do not put tokens in repo `mcp.json` (public package data). Do not paste tokens into chat.

| Variable | Required | Role |
| --- | --- | --- |
| `HARVEST_ACCESS_TOKEN` | yes | `Authorization: Bearer …` |
| `HARVEST_ACCOUNT_ID` | yes | `Harvest-Account-Id` |
| `HARVEST_USER_AGENT` | no | `User-Agent` (default `m2avc-harvest-mcp/<semver> (mn@m2avc.com)` from root `package.json`). CoS may set `harvest-cos-smoke (you@example.com)`. |
| `DANGEROUS_SEND` | no | Default **off**. Only `DANGEROUS_SEND=1` unlocks email send (omit `event_type`), `event_type=send`, and `send_thank_you=true`. Requires Mike GO. |

Copy `servers/harvest-rest/.env.example` locally if useful. Never commit a filled `.env`.

## Start the stdio server

The plugin launches it. To run the same binary yourself (stdio: the process sits on stdin/stdout):

```bash
cd servers/harvest-rest
npm ci
npm run build
export HARVEST_ACCESS_TOKEN="…"
export HARVEST_ACCOUNT_ID="…"
export HARVEST_USER_AGENT="harvest-cos-smoke (you@example.com)"
unset DANGEROUS_SEND
# Do not export DANGEROUS_SEND for smoke. Do not enable it.
node dist/index.js
```

Unit tests (no Harvest, no email) — also run on every PR via `.github/workflows/ci.yml`:

```bash
cd servers/harvest-rest && npm test
```

## Connect in Cursor (Harvest CoS)

1. Official remote MCP (`harvest`) stays at `https://api.harvestapp.com/mcp` — complete Harvest OAuth in the host. Use it to **create a throwaway draft** (`create_invoice` / `create_invoice_from_tracked_time`) on an **M2 internal client**, not a live client job.
2. `harvest-rest` is declared in plugin `mcp.json` as:

   ```json
   "harvest-rest": {
     "type": "stdio",
     "command": "node",
     "args": ["${PLUGIN_ROOT}/servers/harvest-rest/dist/index.js"]
   }
   ```

3. Point Cursor at this checkout (Marketplace plugin, or a real directory copy under `~/.cursor/plugins/local/harvest-mcp` — not a symlink). Reload MCP.
4. Give the stdio process credentials **in Cursor**, not in the committed plugin file. Typical options:
   - Cursor Settings → MCP → `harvest-rest` → environment: `HARVEST_ACCESS_TOKEN`, `HARVEST_ACCOUNT_ID`, `HARVEST_USER_AGENT`
   - or a **user-local** `~/.cursor/mcp.json` (never commit) with the same `env` keys and `command`/`args` pointing at this repo’s `servers/harvest-rest/dist/index.js`
   - or launch Cursor from a shell that already exported those variables (host may inherit them)
5. Confirm **one** `harvest-rest` server (not a second stdio package). Tools must include all **22** names in `REST_TOOL_NAMES` (P0 invoice/rates + P1 cost rates/categories + P2 estimates).

Leave `DANGEROUS_SEND` unset. If it was previously set in Cursor MCP env, remove it and reload MCP before smoke.

## Troubleshooting: missing server vs tool failures

These fail for different reasons. Do not treat a tool error as “the server is missing.”

**`harvest-rest` does not appear at all** (no tools listed, Cursor shows the server failed to start):

- **Node 22+** — `engines` / CI use Node 22. Node 18 may start some paths; Marketplace CoS should match CI.
- **`dist` missing** — run `cd servers/harvest-rest && npm ci && npm run build`. Plugin args point at `${PLUGIN_ROOT}/servers/harvest-rest/dist/index.js`.
- **`PLUGIN_ROOT` / path** — use a real directory copy (Marketplace or `~/.cursor/plugins/local/harvest-mcp`), not a symlink. Confirm `dist/index.js` exists at that resolved path.

**Server starts, tools fail when called** (config / Harvest errors):

- Tokens are **lazy**. `HARVEST_ACCESS_TOKEN` and `HARVEST_ACCOUNT_ID` are read on the first tool request, not at stdio launch. A missing token does **not** hide the server.
- Set credentials in host MCP env (or a user-local `~/.cursor/mcp.json`). Reload MCP after changing env.
- `DANGEROUS_SEND` unset is expected for smoke; send-path tools will error until Mike GO.

## Pre-publish live smoke matrix

**Source of truth for Marketplace republish of ~0.2.0.** Harvest CoS must prove every harvest-rest tool that is safe without **Mike GO**. Run tools **through harvest-rest MCP in Cursor**, not only raw REST/curl or `npm test`.

`REST_TOOL_NAMES` is 22 tools. Each row is one of:

| Tag | Meaning |
| --- | --- |
| **Required live** | Morning CoS default. Read-only, or a reversible mutation on a throwaway draft / M2 internal client. |
| **Optional live** | Safe only if reversible on the M2 internal account. Skip unless the operator can undo it. |
| **Unit-only (gated)** | Out of default smoke. Covered by CI mocks, or a separate Mike-confirm procedure. |

Rules for every live call:

- `DANGEROUS_SEND` **unset**. Clear inherited env and reload MCP before starting.
- Never email a client. Never `event_type=send`. Never `send_thank_you=true`.
- Throwaway **draft** on an **M2 internal client** (official `create_invoice` if needed). Confirm `state` is `draft` via official `get_invoice`.
- Resolve ids from official list tools or from the just-returned list. Do not invent ids, last names, project names, or client names.
- Do not commit tokens, Account IDs, person names, or exact rates.

Automated `test/e2e-live.test.ts` remains a **subset** (throwaway `update_invoice` + payment notes). It does **not** replace this matrix.

| Count | Tag |
| ---: | --- |
| 18 | Required live |
| 2 | Optional live |
| 2 | Unit-only (gated) |

`create_invoice_message` send/email paths stay **Unit-only (gated)** even though the same tool’s non-send events are Required live when a matching-state throwaway exists.

### Matrix (all 22)

| Tool | Tag | Live bar |
| --- | --- | --- |
| `update_invoice` | Required live | Multi-line `notes` on the throwaway draft |
| `delete_invoice` | Required live | Cleanup of that draft (`confirm=true`) if CoS created it |
| `list_invoice_messages` | Required live | List on the throwaway draft (empty list is a pass) |
| `create_invoice_message` | Required live (non-send) / Unit-only (send) | Non-send `event_type` only when the throwaway is already in the matching state. Never omit `event_type`. Never `event_type=send`. |
| `preview_invoice_message` | Required live | `GET .../messages/new` on the throwaway draft |
| `delete_invoice_message` | Required live | Cleanup of a message CoS created (`confirm=true`). Skip if none created. |
| `list_invoice_payments` | Required live | Confirm payment `notes` after create |
| `create_invoice_payment` | Required live | Notes verbatim; `send_thank_you=false` |
| `delete_invoice_payment` | Required live | Cleanup (`confirm=true`) |
| `list_contacts` | Required live | Filter by the M2 internal `client_id` |
| `list_user_billable_rates` | Required live | Operator-supplied `user_id`; report current (`end_date` null) amount as returned |
| `get_user_billable_rate` | Required live | Id from the list just returned |
| `create_user_billable_rate` | Unit-only (gated) | Mike-confirm procedure only |
| `list_user_cost_rates` | Required live | Same operator-supplied `user_id`. Administrator only. |
| `get_user_cost_rate` | Required live | Id from the list just returned. Administrator only. |
| `create_user_cost_rate` | Optional live | Administrator only. Only a **later** `start_date` (no `confirm_replacement`). Omitted, matching, or earlier `start_date` is Mike GO. |
| `list_invoice_item_categories` | Required live | List `kind` categories |
| `get_invoice_item_category` | Required live | Id from the list just returned |
| `create_invoice_item_category` | Optional live | Only if the operator will delete it in the Harvest UI afterward (harvest-rest has no category delete) |
| `list_estimates` | Required live | Read-only; empty list is a pass |
| `get_estimate` | Required live | Id from the list; skip if the list is empty |
| `update_project_user_assignment` | Unit-only (gated) | Mike-confirm procedure only |

### Morning run (Required live) — MCP callbook

Replace every `0` with an id you just resolved. Do not invent ids.

**Setup (official remote MCP, not harvest-rest):**

1. Official `list_clients` → M2 internal client id.
2. Official `create_invoice` on that client if you need a throwaway draft. Official `get_invoice` → `state` is `draft`.
3. Official `list_users` → one operator-supplied `user_id` (first name only in chat; do not publish names or rates).

**Contacts**

```json
{
  "name": "list_contacts",
  "arguments": { "client_id": 0, "per_page": 50 }
}
```

Pass: `200` contact list (may be empty).

**Throwaway draft — invoice reads + non-send mutations**

```json
{
  "name": "update_invoice",
  "arguments": {
    "invoice_id": 0,
    "subject": "COS smoke throwaway — delete after",
    "notes": "  COS smoke — keep  verbatim\n\t#ref  "
  }
}
```

Pass: response `notes` equals that string character-for-character (leading spaces, newline, tab). Do not trim.

```json
{
  "name": "preview_invoice_message",
  "arguments": { "invoice_id": 0 }
}
```

Pass: subject/body preview JSON. Does not create or send a message. Optional second call: `{ "invoice_id": 0, "reminder": true }`.

```json
{
  "name": "list_invoice_messages",
  "arguments": { "invoice_id": 0, "per_page": 50 }
}
```

Pass: `200` message list (empty is OK on a new draft).

Non-send `create_invoice_message` — **only** if a throwaway invoice is already in the matching Harvest state. A **draft** cannot close / draft / re-open. Do **not** call `event_type=send` to change state.

| Current `state` | Allowed `event_type` |
| --- | --- |
| `open` | `close` or `draft` |
| `closed` | `re-open` |
| `draft` | **skip** this tool this run |

```json
{
  "name": "create_invoice_message",
  "arguments": { "invoice_id": 0, "event_type": "close" }
}
```

If you created a message, delete it:

```json
{
  "name": "delete_invoice_message",
  "arguments": { "invoice_id": 0, "message_id": 0, "confirm": true }
}
```

```json
{
  "name": "create_invoice_payment",
  "arguments": {
    "invoice_id": 0,
    "amount": 0.01,
    "paid_date": "2026-09-09",
    "notes": "  COS smoke — keep  verbatim\n\t#ref  ",
    "send_thank_you": false
  }
}
```

Pass: payment `notes` match character-for-character. Then list and delete:

```json
{
  "name": "list_invoice_payments",
  "arguments": { "invoice_id": 0 }
}
```

```json
{
  "name": "delete_invoice_payment",
  "arguments": { "invoice_id": 0, "payment_id": 0, "confirm": true }
}
```

If CoS created the draft, delete it after the invoice steps:

```json
{
  "name": "delete_invoice",
  "arguments": { "invoice_id": 0, "confirm": true }
}
```

**Billable rates (read-only)**

```json
{
  "name": "list_user_billable_rates",
  "arguments": { "user_id": 0 }
}
```

Pass: current rate (`end_date` null) `amount` matches the operator-supplied expected amount. Then `get_user_billable_rate` with `billable_rate_id` from that list:

```json
{
  "name": "get_user_billable_rate",
  "arguments": { "user_id": 0, "billable_rate_id": 0 }
}
```

Do not publish the amount. Official `list_project_assignments` remains the assignment **read** path (report `uses_default_rate` / `hourly_rate` as returned). Do not PATCH assignments in default smoke.

**Cost rates (read-only, Administrator only)**

```json
{
  "name": "list_user_cost_rates",
  "arguments": { "user_id": 0 }
}
```

```json
{
  "name": "get_user_cost_rate",
  "arguments": { "user_id": 0, "cost_rate_id": 0 }
}
```

Pass: list + get `200`. Empty list → skip get. Administrator only (not Manager). Do not publish amounts.

**Invoice item categories (read-only)**

```json
{
  "name": "list_invoice_item_categories",
  "arguments": { "per_page": 50 }
}
```

```json
{
  "name": "get_invoice_item_category",
  "arguments": { "invoice_item_category_id": 0 }
}
```

Pass: list + get `200`. Use an id from the list.

**Estimates (read-only)**

```json
{
  "name": "list_estimates",
  "arguments": { "per_page": 10 }
}
```

```json
{
  "name": "get_estimate",
  "arguments": { "estimate_id": 0 }
}
```

Pass: list `200` (empty is OK). Get only when the list returned an id. Do not send, accept, or create estimates.

### Optional live (reversible M2 only)

Skip these unless an operator can undo them on the M2 internal account. Not required for the morning bar.

**`create_invoice_item_category`** — harvest-rest has **no** category update/delete. Only create a clearly named throwaway (for example `COS smoke — delete after`) if someone will remove it in the Harvest UI the same day.

```json
{
  "name": "create_invoice_item_category",
  "arguments": { "name": "COS smoke — delete after", "use_as_service": true }
}
```

**`create_user_cost_rate`** — Administrator only. Only a `start_date` **after** every existing start on that user (no `confirm_replacement`). An omitted, matching, or earlier `start_date` replaces history and is Mike GO. Cost rates have no delete tool; a later start adds a new period rather than replacing history. Omit this if you cannot accept a new period on the M2 user.

```json
{
  "name": "create_user_cost_rate",
  "arguments": { "user_id": 0, "amount": 0, "start_date": "YYYY-MM-DD" }
}
```

Use the operator-supplied amount and a real past-or-today `start_date` later than the latest listed rate. Do not omit `start_date`. Do not use a matching or earlier `start_date`. Do not publish the amount.

### Unit-only (gated) / Mike-confirm procedure

Out of default smoke. CI already mocks these. Live writes need an explicit operator request **and** confirmation.

| Tool / path | Why gated |
| --- | --- |
| `create_user_billable_rate` | Replaces or adds a default billable rate |
| `update_project_user_assignment` | Changes assignment `use_default_rates` / `hourly_rate` |
| `create_user_cost_rate` with omitted, matching, or earlier `start_date` | Requires `confirm_replacement=true` (Mike GO) |
| `create_invoice_message` omit `event_type` | Emails the client (`DANGEROUS_SEND=1` + Mike GO) |
| `create_invoice_message` `event_type=send` | Marks a draft sent (`DANGEROUS_SEND=1` + Mike GO) |
| `create_invoice_payment` `send_thank_you=true` | Thank-you email (`DANGEROUS_SEND=1` + Mike GO) |

Rate-write procedure (only when an operator has explicitly asked to change a rate):

1. Resolve the user / assignment ids from official list tools. Do not invent ids.
2. Preview the current rate (`list_user_billable_rates`, `list_user_cost_rates`, or official `list_project_assignments`).
3. Get explicit confirmation of the new amount and `start_date` (or assignment `hourly_rate` / `use_default_rates`).
4. Then call the write tool.

### Do not call in default smoke

- `create_invoice_message` with **no** `event_type` (emails the client)
- `create_invoice_message` with `event_type=send` (marks sent; Mike GO only)
- `create_invoice_payment` with `send_thank_you=true`
- `create_user_billable_rate`
- `update_project_user_assignment`
- `create_user_cost_rate` without a later `start_date`, or with `confirm_replacement`

Those send and rate-write paths are unit/mocked in CI `npm test`. Live send stays behind `DANGEROUS_SEND=1` + Mike GO.

## Marketplace publish

CI + CoS smoke are necessary, not sufficient. **Mike human GO** is required before a Marketplace publish or a public version tag.
