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
5. Confirm **one** `harvest-rest` server (not a second stdio package). Tools must include invoice + rate tools.

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

## Live CoS smoke — required before merge of release-affecting tools / before publish

Run these **through harvest-rest MCP tools in Cursor**, not only raw REST/curl. That is the Marketplace path.

Preconditions:

- **Throwaway draft only** on an **M2 internal client** (create via official `create_invoice` if needed). Confirm `state` is `draft` via official `get_invoice`.
- `DANGEROUS_SEND` **unset**. No client email. No `event_type=send`. No `send_thank_you=true`.
- Do not invent last names, project names, or client names.

### 1. `update_invoice` — multi-line notes (MCP)

Call harvest-rest `update_invoice` with this **exact** `notes` string (leading spaces, newline, tab). Do not trim.

```json
{
  "invoice_id": 0,
  "subject": "COS smoke throwaway — delete after",
  "notes": "  COS smoke — keep  verbatim\n\t#ref  "
}
```

Replace `0` with the throwaway draft id. Pass: response `notes` equals that string character-for-character.

### 2. `create_invoice_payment` notes + delete (MCP)

```json
{
  "invoice_id": 0,
  "amount": 0.01,
  "paid_date": "2026-09-08",
  "notes": "  COS smoke — keep  verbatim\n\t#ref  ",
  "send_thank_you": false
}
```

Pass: payment `notes` match character-for-character (`list_invoice_payments` must show the same). Then `delete_invoice_payment` with `confirm=true`. Delete the throwaway draft if you created it for the smoke (`delete_invoice` also requires `confirm=true`).

### 3. Rates — read-only when rates tools change

When the PR touches billable rates, cost rates, or assignment rates:

1. Official `list_users` → operator-supplied user id → harvest-rest `list_user_billable_rates`. Pass: current rate (`end_date` null) `amount` matches the operator-supplied expected amount.
2. Official `list_users` → operator-supplied user id → official `list_project_assignments`. Report `uses_default_rate` / `hourly_rate` as returned.

Do not invent ids. Do not commit person names or exact live rates.

Do **not** call `update_project_user_assignment`, `create_user_billable_rate`, or other rate writes during smoke.

### 4. Rate writes — separate confirm-required procedure (not smoke)

Only when an operator has explicitly asked to change a rate:

1. Resolve the user / assignment ids from official list tools. Do not invent ids.
2. Preview the current rate (`list_user_billable_rates` or official `list_project_assignments`).
3. Get explicit confirmation of the new amount and `start_date` (or assignment `hourly_rate` / `use_default_rates`).
4. Then call the write tool. Omit this entire section from default CoS smoke.

### Do not call in smoke

- `create_invoice_message` with **no** `event_type` (emails the client)
- `create_invoice_message` with `event_type=send` (marks sent; Mike GO only)
- `create_invoice_payment` with `send_thank_you=true`

Those send paths are unit/mocked in CI `npm test`. Live send stays behind `DANGEROUS_SEND=1` + Mike GO.

## Marketplace publish

CI + CoS smoke are necessary, not sufficient. **Mike human GO** is required before a Marketplace publish or a public version tag.
