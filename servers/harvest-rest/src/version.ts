import pluginPackage from "../../../package.json" with { type: "json" };

/**
 * Marketplace semver from the **repo-root** `package.json` (single source of truth).
 * Default Harvest User-Agent is `m2avc-harvest-mcp/<this> (mn@m2avc.com)`.
 * Keep `plugin.json` and `servers/harvest-rest/package.json` versions in lockstep
 * (enforced by unit test). esbuild inlines this value into `dist/index.js`.
 */
export const PACKAGE_VERSION: string = pluginPackage.version;
