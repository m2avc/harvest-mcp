import { z } from "zod";

/** UTC YYYY-MM-DD for "today" comparisons. Zod 3 compatible (no z.iso). */
export function utcTodayIsoDate(nowMs: number = Date.now()): string {
  return new Date(nowMs).toISOString().slice(0, 10);
}

export function isRealIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/**
 * YYYY-MM-DD, real calendar date, not in the future.
 * Uses refine() so this stays Zod 3 compatible.
 */
export const isoDateSchema = z
  .string()
  .refine(isRealIsoDate, "start_date must be a real YYYY-MM-DD calendar date")
  .refine((value) => value <= utcTodayIsoDate(), "start_date must not be in the future");
