import { z } from "zod";

import { PACKAGE_VERSION } from "./version.js";

/**
 * Marketplace default User-Agent (Mike-locked 2026-09-08):
 * `m2avc-harvest-mcp/<semver> (mn@m2avc.com)`
 * Semver comes from repo-root `package.json`. `HARVEST_USER_AGENT` still wins.
 * Harvest requires the *integration author* contact, not the end customer's
 * Harvest email or company. https://help.getharvest.com/api-v2/introduction/overview/general/
 */
export const DEFAULT_HARVEST_USER_AGENT = `m2avc-harvest-mcp/${PACKAGE_VERSION} (mn@m2avc.com)`;
export const DEFAULT_HARVEST_API_BASE = "https://api.harvestapp.com/v2";

/** Minimum length of `go_ref` after collapsing C0 / DEL / whitespace (matches audit). */
export const MIN_GO_REF_LENGTH = 8;

/** Maximum length of sanitized `go_ref` (after collapsing C0 / DEL / whitespace). */
export const MAX_GO_REF_LENGTH = 500;

/**
 * Raw `go_ref` size/DoS ceiling on the Zod schema only.
 * Clearly larger than `MAX_GO_REF_LENGTH` so a quote that collapses to ≤500
 * characters is not rejected before `sanitizeGoRefForOutput`. The 500 limit
 * applies only to the sanitized value (gate and audit).
 */
export const MAX_GO_REF_RAW_LENGTH = 8192;

/** User-facing length rule; matches `sanitizeGoRefForOutput` then the min/max checks. */
const GO_REF_LENGTH_HINT = `${MIN_GO_REF_LENGTH}–${MAX_GO_REF_LENGTH} characters after collapsing control characters and whitespace`;

/** Appended when an echoed / blocked `go_ref` is truncated to `MAX_GO_REF_LENGTH`. */
export const GO_REF_TRUNCATION_MARKER = "…[truncated]";

/** C0 controls (U+0000–U+001F), DEL (U+007F), and any whitespace run. */
const GO_REF_UNSAFE_RUN = /[\u0000-\u001F\u007F\s]+/g;

export type HarvestEnv = {
  accessToken: string;
  accountId: string;
  userAgent: string;
  apiBase: string;
};

export type LiveSendConfirmation = {
  confirm_live_send?: boolean;
  go_ref?: string;
};

/** Harvest payload fields stay at the top level; `go_ref` is the audit field. */
export type LiveSendAuditResult<T = unknown> = T & {
  go_ref: string;
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

export const liveSendConfirmationFields = {
  confirm_live_send: z
    .boolean()
    .optional()
    .describe(
      "Required true for email send (omit event_type), event_type=send, or send_thank_you. Per-call intent on top of DANGEROUS_SEND=1. Not sent to Harvest.",
    ),
  go_ref: z
    .string()
    .max(
      MAX_GO_REF_RAW_LENGTH,
      `go_ref must be at most ${MAX_GO_REF_RAW_LENGTH} characters`,
    )
    .optional()
    .describe(
      `Short quote or reference to Mike's explicit GO message (${GO_REF_LENGTH_HINT}). Required for gated live sends. Included in tool text and a stderr audit line. Not sent to Harvest.`,
    ),
};

/** Email / mark-as-sent / payment thank-you email. Defaults off. Requires Mike GO. */
export function isDangerousSendEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.DANGEROUS_SEND === "1";
}

/**
 * Smoke / test / explicit lockout. Gated sends are refused even when
 * DANGEROUS_SEND=1 and confirm_live_send + go_ref are present.
 */
export function isSendLockoutEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.HARVEST_SMOKE === "1" || env.NODE_ENV === "test" || env.HARVEST_SEND_LOCKOUT === "1";
}

/** Collapse C0 / DEL / whitespace runs, then trim. Safe for stderr and error text. */
export function sanitizeGoRefForOutput(goRef: string): string {
  return goRef.replace(GO_REF_UNSAFE_RUN, " ").trim();
}

function truncateGoRefForEcho(sanitized: string): string {
  if (sanitized.length <= MAX_GO_REF_LENGTH) {
    return sanitized;
  }
  return `${sanitized.slice(0, MAX_GO_REF_LENGTH)}${GO_REF_TRUNCATION_MARKER}`;
}

export function formatGoRefForMessage(goRef: string | undefined): string {
  if (goRef === undefined) {
    return "(missing)";
  }
  const sanitized = sanitizeGoRefForOutput(goRef);
  return sanitized.length === 0 ? "(empty)" : truncateGoRefForEcho(sanitized);
}

export function readGoRef(goRef: string | undefined): string | undefined {
  if (goRef === undefined) {
    return undefined;
  }
  const trimmed = goRef.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

export function attachLiveSendAudit<T>(harvest: T, goRef: string): LiveSendAuditResult<T> {
  if (harvest !== null && typeof harvest === "object") {
    return { ...harvest, go_ref: goRef };
  }
  return { go_ref: goRef } as LiveSendAuditResult<T>;
}

export function logLiveSendAudit(
  action: string,
  goRef: string,
  write: (line: string) => void = (line) => {
    process.stderr.write(line);
  },
): void {
  const oneLine = truncateGoRefForEcho(sanitizeGoRefForOutput(goRef));
  write(`harvest-rest live send: action=${action} go_ref=${oneLine}\n`);
}

function blockedMessage(action: string, detail: string, goRef: string | undefined): string {
  return `${action} is blocked: ${detail} go_ref=${formatGoRefForMessage(goRef)}`;
}

/**
 * Master switch is still DANGEROUS_SEND=1 (default off). Gated live sends also
 * require confirm_live_send=true and a non-empty go_ref (8–500 chars after
 * collapsing control characters and whitespace). Smoke / test /
 * HARVEST_SEND_LOCKOUT always refuse. Returns the sanitized go_ref
 * (C0 / DEL / whitespace collapsed, 8–500 characters).
 */
export function assertDangerousSendAllowed(
  action: string,
  env: NodeJS.ProcessEnv = process.env,
  confirmation: LiveSendConfirmation = {},
): string {
  const goRef = confirmation.go_ref;

  if (isSendLockoutEnabled(env)) {
    throw new DangerousSendBlockedError(
      blockedMessage(
        action,
        "smoke/test/lockout mode (HARVEST_SMOKE=1, NODE_ENV=test, or HARVEST_SEND_LOCKOUT=1) refuses gated sends even with DANGEROUS_SEND=1 and confirm_live_send=true. Do not email real client invoices or mark them sent in smoke tests. Use a throwaway draft + create_invoice_payment notes round-trip instead.",
        goRef,
      ),
    );
  }

  if (!isDangerousSendEnabled(env)) {
    throw new DangerousSendBlockedError(
      blockedMessage(
        action,
        `DANGEROUS_SEND=1 (default off), confirm_live_send=true, and a non-empty go_ref (short quote of Mike's explicit GO, ${GO_REF_LENGTH_HINT}) are required. Do not email real client invoices or mark them sent in smoke tests. Use a throwaway draft + create_invoice_payment notes round-trip instead.`,
        goRef,
      ),
    );
  }

  if (confirmation.confirm_live_send !== true) {
    throw new DangerousSendBlockedError(
      blockedMessage(
        action,
        `confirm_live_send=true is required (per-call intent on top of DANGEROUS_SEND=1), plus a non-empty go_ref (short quote of Mike's explicit GO, ${GO_REF_LENGTH_HINT}). Do not email real client invoices or mark them sent in smoke tests.`,
        goRef,
      ),
    );
  }

  const trimmed = readGoRef(goRef);
  const sanitized = trimmed === undefined ? "" : sanitizeGoRefForOutput(trimmed);
  if (trimmed === undefined || sanitized.length < MIN_GO_REF_LENGTH) {
    throw new DangerousSendBlockedError(
      blockedMessage(
        action,
        `go_ref must be a non-empty string (short quote of Mike's explicit GO, ${GO_REF_LENGTH_HINT}). Do not email real client invoices or mark them sent in smoke tests.`,
        goRef,
      ),
    );
  }
  if (sanitized.length > MAX_GO_REF_LENGTH) {
    throw new DangerousSendBlockedError(
      blockedMessage(
        action,
        `go_ref must be at most ${MAX_GO_REF_LENGTH} characters after collapsing control characters and whitespace. Do not email real client invoices or mark them sent in smoke tests.`,
        goRef,
      ),
    );
  }

  logLiveSendAudit(action, sanitized);
  return sanitized;
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
 * Account identity is Harvest-Account-Id + token only — never derive User-Agent
 * from an end-user Harvest email or company name.
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
