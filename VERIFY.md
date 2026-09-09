# Prove locally — harvest-mcp (2026-09-08)

| Step | Result |
| --- | --- |
| Schema `plugin.json` | PASS (agent-plugins 1.0.0 via jsonschema Draft202012 against live schema) |
| Schema `mcp.json` | PASS (`harvest` streamable-http → `https://api.harvestapp.com/mcp`; `harvest-rest` stdio → `node ${PLUGIN_ROOT}/servers/harvest-rest/dist/index.js`) |
| Skills frontmatter | PASS (`use-harvest-mcp`, `harvest-timers-and-time`, `harvest-projects-clients-tasks`, `harvest-expenses`, `harvest-invoices`, `harvest-rates-and-assignments`) |
| Official 35-tool map | PASS (all 35 tools named in `skills/use-harvest-mcp/SKILL.md`) |
| harvest-rest tools | PASS (P0 invoice/rates + P1 cost rates + invoice item categories) — **one** stdio server |
| Unit tests | PASS → `cd servers/harvest-rest && npm test` (invoice + rates paths; no live creds). CI: `.github/workflows/ci.yml` on every PR. |
| Typecheck + bundle | PASS → `npm run typecheck && npm run build` |
| Public-safe scan | PASS (mcp.json, .env.example, COS-RUNBOOK, skills: no tokens / Account IDs / live person names / exact rates) |
| Local install path | PASS → `~/.cursor/plugins/local/harvest-mcp` (real directory copy, not symlink to workspace) when proven on Cursor IDE |
| `@anysphere/cursor-plugins` loader | SKIP on Grok Bot box (package/IDE loader not available the same way as Cursor IDE) |
| Customize / Reload Window | SKIP — Grok Bot does not load `~/.cursor/plugins/local`; Marketplace/dashboard plugins only |
| Live MCP OAuth smoke | SKIP here — host may already have a user Harvest connection separately |
| Live harvest-rest CoS smoke | SKIP in CI — CoS via harvest-rest MCP before merge/publish (see COS-RUNBOOK). Throwaway draft on M2 internal client. No invoice email. Mike GO before Marketplace publish. |

## harvest-rest unit coverage (no secrets)

From `servers/harvest-rest`:

```bash
npm ci
npm test
npm run typecheck
npm run build
```

Asserted without calling Harvest:

- `PATCH /v2/invoices/{id}` header + line item create / update / `_destroy`
- `POST /v2/invoices/{id}/messages` with `event_type=send` / email path — **mocked only**, or `DANGEROUS_SEND=1`
- Send path **blocked** when `DANGEROUS_SEND` is unset (default)
- Email path (omit `event_type`) requires recipients or `send_me_a_copy`
- `GET /v2/invoices/{id}/messages/new` preview
- `POST /v2/invoices/{id}/payments` **notes character-for-character** (whitespace, quotes, unicode); `send_thank_you` forced false
- `GET/POST /v2/users/{id}/billable_rates` and GET-by-id
- `PATCH /v2/projects/{id}/user_assignments/{id}` maps `uses_default_rate` → `use_default_rates`
- Default User-Agent `m2avc-harvest-mcp/<semver> (mn@m2avc.com)` from root `package.json`; `HARVEST_USER_AGENT` override; 429 `Retry-After` retry; 4xx/5xx mapping (no token leak)
- `fetchWithTimeout` (default 30s; `timeoutMs: 0` disables) wraps **each** 429 retry attempt
- `delete_invoice` / `delete_invoice_message` / `delete_invoice_payment` require `confirm: true`
- Payment `amount` finite and `> 0`; line items with `_destroy: true` require `id`; payment `inputSchema` is a plain ZodObject
- P1: invoice item categories list/get/create; user cost rates list/get/create (mocked; no live send)

## Live CoS smoke (optional; do not commit tokens)

See `servers/harvest-rest/COS-RUNBOOK.md` for how CoS connects (`HARVEST_ACCESS_TOKEN`, `HARVEST_ACCOUNT_ID`, `User-Agent`).

**Stacked on PR #9 → #4:** P0 API v2 compliance + Marketplace security gate + CodeRabbit follow-ups remain on the base. This revision adds P1 invoice item categories and user cost rates on the same harvest-rest stdio server. CoS live smoke before merge of release-affecting tools / before publish: throwaway draft on M2 internal client; `update_invoice` multi-line notes and `create_invoice_payment` notes + delete **via harvest-rest MCP**; rates read-only when rates tools change. `DANGEROUS_SEND` unset (clear inherited env + reload MCP). No client email. **Mike human GO** before Marketplace publish or a public version tag.

Invoice e2e (not this PR’s bar):

Set in the **local environment only**:

- `HARVEST_ACCESS_TOKEN`
- `HARVEST_ACCOUNT_ID`
- `HARVEST_E2E_INVOICE_ID` — **throwaway draft** id (not a live client invoice)
- `HARVEST_E2E_ALLOW_MUTATIONS=1`
- Do **not** set `DANGEROUS_SEND`

Then:

```bash
cd servers/harvest-rest && npm test
```

The live test (`test/e2e-live.test.ts`) will:

1. `update_invoice` (purchase_order stamp) on that draft
2. `create_invoice_payment` with a notes string that must round-trip exactly (`send_thank_you=false`)
3. `delete_invoice_payment` cleanup
4. `delete_invoice` only if `HARVEST_E2E_DELETE_INVOICE=1`

## Note

Proving local install still matters for Cursor IDE. On Grok Bot, confirm packaging via schema + directory layout + `servers/harvest-rest` tests; runtime MCP remains whatever the host already connected until the plugin is installed through dashboard/Marketplace/directory.
