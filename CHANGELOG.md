# Changelog

All notable changes to this Marketplace plugin are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Version fields that must stay equal: root `package.json`, `plugin.json`, and
`servers/harvest-rest/package.json`. Default Harvest User-Agent is
`m2avc-harvest-mcp/<semver> (mn@m2avc.com)` from the root `package.json` semver.

Do not put tokens, Account IDs, person names, or exact live rates in this file.

## [0.3.0] - 2026-09-09

Marketplace republish prep. `harvest-rest` remains the plugin’s single REST
stdio entrypoint. Official remote MCP is unchanged (35 tools at
`https://api.harvestapp.com/mcp`).

### harvest-rest tools

- Invoice update/delete, messages (including preview), and payments
- `list_contacts` helper to resolve invoice email recipients
- User billable rates (list/get/create) and project assignment hourly-rate PATCH
- User cost rates (list/get/create) and invoice item categories (list/get/create)
- Read-only estimates (`list_estimates`, `get_estimate`)

### Marketplace security gate

- `DANGEROUS_SEND` default unset/off; email, `event_type=send`, and payment
  thank-you stay Mike-GO only
- Default User-Agent `m2avc-harvest-mcp/0.3.0 (mn@m2avc.com)` from root
  `package.json`; `HARVEST_USER_AGENT` still overrides
- CI: typecheck, unit tests with send paths disabled, public-safe scan
- CoS runbook: throwaway-draft smoke, PAT vs OAuth least privilege, no secrets
  in committed `mcp.json`

### Harden follow-ups

- MCP cancellation / AbortSignal wiring on Harvest HTTP waits
- Shared ISO date schemas for rate and payment dates
- Administrator-only docs for cost-rate tools
- Finite, positive payment amounts
- Equal `start_date` on cost-rate create requires `confirm_replacement`

### CoS pre-publish smoke

- Expanded live smoke matrix in `servers/harvest-rest/COS-RUNBOOK.md` and
  `VERIFY.md` covering all 22 `REST_TOOL_NAMES` (Required live / Optional live /
  Unit-only gated)
- Automated `e2e-live` remains a subset; it does not replace the matrix
