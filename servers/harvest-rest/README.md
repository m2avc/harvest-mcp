# harvest-rest

Custom **stdio MCP server** for Harvest API v2 resources that the official remote MCP (`https://api.harvestapp.com/mcp`) does not expose.

This is the **single** REST entrypoint for this plugin. Do not add a second stdio package.

## Tools (P0)

Invoice update/messages/payments plus user billable rates and project assignment hourly rates. See the root README, [User billable rates](https://help.getharvest.com/api-v2/users-api/users/billable-rates/), and [Project user assignments](https://help.getharvest.com/api-v2/projects-api/projects/user-assignments/).

## Auth

Environment only (never commit):

| Variable | Required | Header / use |
| --- | --- | --- |
| `HARVEST_ACCESS_TOKEN` | yes | `Authorization: Bearer …` |
| `HARVEST_ACCOUNT_ID` | yes | `Harvest-Account-Id` |
| `HARVEST_USER_AGENT` | no | `User-Agent` (default `m2avc-harvest-mcp/<semver> (mn@m2avc.com)`; `<semver>` from repo-root `package.json`). Harvest requires the integration author contact, not the end-user email. See [Overview](https://help.getharvest.com/api-v2/introduction/overview/general/). |
| `HARVEST_API_BASE` | no | Override API root (tests) |
| `DANGEROUS_SEND` | no | Must be `1` to email, `event_type=send`, or `send_thank_you=true`. Default off. Mike GO required. |

Copy `.env.example` locally. Do not put tokens in plugin `mcp.json`.

CoS local runbook (Cursor connect + smoke examples): [COS-RUNBOOK.md](./COS-RUNBOOK.md).

API v2 endpoint vs tool map (P0/P1/P2): [docs/API_V2_GAP_MATRIX.md](../../docs/API_V2_GAP_MATRIX.md).

Rate limits ([Overview](https://help.getharvest.com/api-v2/introduction/overview/general/)): **100 requests / 15 seconds** general; Reports **100 / 15 minutes**. `429` includes `Retry-After`. harvest-rest retries short waits in `src/harvest-client.ts`.

## Develop

```bash
npm ci
npm test
npm run typecheck
npm run build
```

`dist/index.js` is the plugin launch target (`node ${PLUGIN_ROOT}/servers/harvest-rest/dist/index.js`).
