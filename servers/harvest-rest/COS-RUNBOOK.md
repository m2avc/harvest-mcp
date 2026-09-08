# Harvest CoS local runbook — harvest-rest

Keep PRs **draft** until Harvest CoS smoke passes. Never email a real client invoice. Never `event_type=send` on a live client invoice without **Mike GO**.

**Stacked PR #2 live bar (unchanged):** list rates / verify **Chad $145**, then **Arabella** assignment rates. Do not invent last names, project names, or client names.

Sister PR #1 invoice bar (same server, later or separately): throwaway draft + `update_invoice` + `create_invoice_payment` notes. Not required to merge rates.

This compliance PR is **client reliability + gap matrix only**. It does not add domain tools. Do not undraft #1/#2 from here.

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
# Do not export DANGEROUS_SEND for smoke.
node dist/index.js
```

Unit tests (no Harvest, no email):

```bash
cd servers/harvest-rest && npm test
```

## Connect in Cursor (Harvest CoS)

1. Official remote MCP (`harvest`) stays at `https://api.harvestapp.com/mcp` — complete Harvest OAuth in the host. Use it to **create a throwaway draft** (`create_invoice` / `create_invoice_from_tracked_time`) on a test client, not a live client job.
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
5. Confirm **one** `harvest-rest` server (not a second stdio package). Tools must include `list_user_billable_rates`, `get_user_billable_rate`, `create_user_billable_rate`, `update_project_user_assignment` plus the invoice tools from PR #1. If `harvest-rest` is missing, Node 18+ is required and the env/path is wrong.

Leave `DANGEROUS_SEND` unset.

## Suggested CoS smoke — rates (this PR)

Read-only. First names only as Harvest already used. Do **not** send invoices or client emails.

### 1. Chad — default billable rate $145

1. Official `list_users` → find **Chad** → note `user_id`.
2. harvest-rest `list_user_billable_rates` `{ "user_id": <chad> }`.
3. Pass: the current rate (`end_date` null) `amount` is **145**.

Minimal tool call:

```json
{
  "name": "list_user_billable_rates",
  "arguments": { "user_id": 0 }
}
```

Replace `0` with Chad’s id. Do not invent the id.

### 2. Arabella — assignment rates

1. Official `list_users` → find **Arabella**.
2. Official `list_project_assignments` (and harvest-rest `update_project_user_assignment` only if you must change a rate).
3. Report `uses_default_rate` / `use_default_rates` and `hourly_rate` / `billable_rate` as returned. Do not invent project or client names.

## Smoke examples — invoices (sister PR #1, throwaway draft only)

Use a draft created for this test. Confirm `state` is `draft` via official `get_invoice`. Do not use a sent/open client invoice.

### 1. `update_invoice`

```json
{
  "invoice_id": 0,
  "purchase_order": "cos-smoke-po",
  "subject": "COS smoke throwaway — delete after"
}
```

Replace `0` with the throwaway draft id. Expected: `200` invoice JSON with those header fields. Line-item create/update/`_destroy` may be exercised on the same throwaway draft only.

### 2. `create_invoice_payment` — notes verbatim

Use this **exact** notes string (leading spaces, newline, tab). Do not trim or rewrite.

```json
{
  "invoice_id": 0,
  "amount": 0.01,
  "paid_date": "2026-09-08",
  "notes": "  COS smoke — keep  verbatim\n\t#ref  ",
  "send_thank_you": false
}
```

Pass: response `notes` equals that string character-for-character (`list_invoice_payments` must show the same). This server forces `send_thank_you=false` unless `DANGEROUS_SEND=1`.

Cleanup: `delete_invoice_payment`, then `delete_invoice` on the throwaway draft if you created it for the smoke.

### Do not call in smoke

- `create_invoice_message` with **no** `event_type` (emails the client)
- `create_invoice_message` with `event_type=send` (marks sent; Mike GO only)
- `create_invoice_payment` with `send_thank_you=true`

Those send paths are unit/mocked in `npm test`. Live send stays behind `DANGEROUS_SEND=1` + Mike GO.
