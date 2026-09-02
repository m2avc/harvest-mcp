# Prove locally — harvest-mcp (2026-09-01)

| Step | Result |
| --- | --- |
| Schema `plugin.json` | PASS (agent-plugins 1.0.0 via jsonschema Draft202012 against live schema) |
| Schema `mcp.json` | PASS (`type: streamable-http` → `https://api.harvestapp.com/mcp`) |
| Skills frontmatter | PASS (`use-harvest-mcp`, `harvest-timers-and-time`, `harvest-projects-clients-tasks`, `harvest-expenses`, `harvest-draft-invoices`) |
| Official 35-tool map | PASS (all 35 tools named in `skills/use-harvest-mcp/SKILL.md`) |
| Public-safe scan | PASS (README + skills: no private client names / M2 markers) |
| Local install path | PASS → `~/.cursor/plugins/local/harvest-mcp` (real directory copy, not symlink to workspace) |
| `@anysphere/cursor-plugins` loader | SKIP on Grok Bot box (package/IDE loader not available the same way as Cursor IDE) |
| Customize / Reload Window | SKIP — Grok Bot does not load `~/.cursor/plugins/local`; Marketplace/dashboard plugins only |
| Live MCP OAuth smoke | SKIP here — host may already have a user Harvest connection separately; plugin packaging prove does not re-auth |

## Note

Proving local install still matters for Cursor IDE. On Grok Bot, confirm packaging via schema + directory layout; runtime MCP remains whatever the host already connected until the plugin is installed through dashboard/Marketplace/directory.
