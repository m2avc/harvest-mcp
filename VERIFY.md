# Prove locally — harvest-mcp (2026-09-08)

| Step | Result |
| --- | --- |
| Schema `plugin.json` | PASS (agent-plugins 1.0.0 via jsonschema Draft202012 against live schema) |
| Schema `mcp.json` | PASS (`harvest` streamable-http → `https://api.harvestapp.com/mcp`; `harvest-rest` stdio → `node ${PLUGIN_ROOT}/servers/harvest-rest/dist/index.js`) |
| Skills frontmatter | PASS (`use-harvest-mcp`, `harvest-timers-and-time`, `harvest-projects-clients-tasks`, `harvest-expenses`, `harvest-invoices`) |
| Official 35-tool map | PASS (all 35 tools named in `skills/use-harvest-mcp/SKILL.md`) |
| harvest-rest P0 tools | PASS (`update_invoice`, `delete_invoice`, message + payment tools, `preview_invoice_message`, `list_contacts`) |
| Unit tests | PASS → `cd servers/harvest-rest && npm test` (update + message send + payment notes verbatim; no live creds) |
| Typecheck + bundle | PASS → `npm run typecheck && npm run build` |
| Public-safe scan | PASS (README + skills: no private client names / tokens / Account IDs) |
| Local install path | PASS → `~/.cursor/plugins/local/harvest-mcp` (real directory copy, not symlink to workspace) when proven on Cursor IDE |
| `@anysphere/cursor-plugins` loader | SKIP on Grok Bot box (package/IDE loader not available the same way as Cursor IDE) |
| Customize / Reload Window | SKIP — Grok Bot does not load `~/.cursor/plugins/local`; Marketplace/dashboard plugins only |
| Live MCP OAuth smoke | SKIP here — host may already have a user Harvest connection separately |
| Live harvest-rest E2E | SKIP in CI without creds — see shape below |

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
- `POST /v2/invoices/{id}/messages` with `event_type=send` (and close / draft / re-open)
- Email path (omit `event_type`) requires recipients or `send_me_a_copy`
- `GET /v2/invoices/{id}/messages/new` preview
- `POST /v2/invoices/{id}/payments` **notes character-for-character** (whitespace, quotes, unicode)

## Live E2E shape (optional; do not commit tokens)

Set in the **local environment only**:

- `HARVEST_ACCESS_TOKEN`
- `HARVEST_ACCOUNT_ID`
- `HARVEST_E2E_INVOICE_ID` — existing draft/test invoice
- `HARVEST_E2E_ALLOW_MUTATIONS=1`

Then:

```bash
cd servers/harvest-rest && npm test
```

The live test (`test/e2e-live.test.ts`) will:

1. `update_invoice` (purchase_order stamp)
2. `create_invoice_message` `event_type=send`
3. `create_invoice_payment` with a notes string that must round-trip exactly
4. `delete_invoice_payment` cleanup
5. `delete_invoice` only if `HARVEST_E2E_DELETE_INVOICE=1`

## Note

Proving local install still matters for Cursor IDE. On Grok Bot, confirm packaging via schema + directory layout + `servers/harvest-rest` tests; runtime MCP remains whatever the host already connected until the plugin is installed through dashboard/Marketplace/directory.
