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

export class DangerousSendBlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DangerousSendBlockedError";
  }
}

/** Email / mark-as-sent / payment thank-you email. Defaults off. Requires Mike GO. */
export function isDangerousSendEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.DANGEROUS_SEND === "1";
}

export function assertDangerousSendAllowed(action: string, env: NodeJS.ProcessEnv = process.env): void {
  if (isDangerousSendEnabled(env)) {
    return;
  }
  throw new DangerousSendBlockedError(
    `${action} is blocked unless DANGEROUS_SEND=1 (default off) and Mike has GO'd a live send. Do not email real client invoices or mark them sent in smoke tests. Use a throwaway draft + create_invoice_payment notes round-trip instead.`,
  );
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
