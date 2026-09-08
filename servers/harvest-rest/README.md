# harvest-rest

Custom **stdio MCP server** for Harvest API v2 resources that the official remote MCP (`https://api.harvestapp.com/mcp`) does not expose.

This is the **single** REST entrypoint for this plugin. Add later gaps (billable rates, etc.) here — do not add a second stdio package.

## Tools (P0)

See the root README and [Harvest API v2](https://help.getharvest.com/api-v2/).

## Auth

Environment only (never commit):

| Variable | Required | Header / use |
| --- | --- | --- |
| `HARVEST_ACCESS_TOKEN` | yes | `Authorization: Bearer …` |
| `HARVEST_ACCOUNT_ID` | yes | `Harvest-Account-Id` |
| `HARVEST_USER_AGENT` | no | `User-Agent` (default `m2avc-harvest-mcp (support@m2avc.com)`) |
| `HARVEST_API_BASE` | no | Override API root (tests) |

Copy `.env.example` locally. Do not put tokens in plugin `mcp.json`.

## Develop

```bash
npm ci
npm test
npm run typecheck
npm run build
```

`dist/index.js` is the plugin launch target (`node ${PLUGIN_ROOT}/servers/harvest-rest/dist/index.js`).
