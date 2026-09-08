export const DEFAULT_HARVEST_USER_AGENT = "m2avc-harvest-mcp (support@m2avc.com)";
export const DEFAULT_HARVEST_API_BASE = "https://api.harvestapp.com/v2";

export type HarvestEnv = {
  accessToken: string;
  accountId: string;
  userAgent: string;
  apiBase: string;
};

export class HarvestConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HarvestConfigError";
  }
}

function readTrimmed(env: NodeJS.ProcessEnv, key: string): string | undefined {
  const raw = env[key];
  if (raw === undefined) {
    return undefined;
  }
  const trimmed = raw.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

/**
 * Reads Harvest REST credentials from the process environment.
 * Tokens must never be logged or written to repo files.
 */
export function readHarvestEnv(env: NodeJS.ProcessEnv = process.env): HarvestEnv {
  const accessToken = readTrimmed(env, "HARVEST_ACCESS_TOKEN");
  const accountId = readTrimmed(env, "HARVEST_ACCOUNT_ID");
  const userAgent = readTrimmed(env, "HARVEST_USER_AGENT") ?? DEFAULT_HARVEST_USER_AGENT;
  const apiBase = readTrimmed(env, "HARVEST_API_BASE") ?? DEFAULT_HARVEST_API_BASE;

  if (!accessToken || !accountId) {
    throw new HarvestConfigError(
      "harvest-rest requires HARVEST_ACCESS_TOKEN and HARVEST_ACCOUNT_ID in the process environment. Do not paste tokens into chat or commit them. Official remote MCP (OAuth) is unchanged at https://api.harvestapp.com/mcp.",
    );
  }

  return { accessToken, accountId, userAgent, apiBase };
}
