/**
 * Per-BU request helpers for the DB-objects-across-BUs page, which fires one request per BU
 * (scan, dry-run, apply) and so can run into the gateway's per-IP rate limit on a large fleet.
 */

/** How many BUs are worked on at once. Keeps a full scan well under the gateway's 300/min. */
export const FLEET_CONCURRENCY = 3;

const statusOf = (err: unknown): number | undefined =>
  (err as { response?: { status?: number } })?.response?.status;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Run `fn`, waiting and retrying when the gateway answers 429. Any other failure is thrown at
 * once — a DDL error in one BU must not be retried blindly.
 */
export async function withRateLimitRetry<T>(
  fn: () => Promise<T>,
  { retries = 3, waitMs = 5000 }: { retries?: number; waitMs?: number } = {},
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (statusOf(err) !== 429 || attempt >= retries) throw err;
      await sleep(waitMs * (attempt + 1));
    }
  }
}

/**
 * The server's own message for a failed per-BU call — e.g. the Postgres error from a dry-run.
 *
 * Read from `response.data.message` directly, not through getErrorDetail(): that helper replaces
 * every message with "try again later" on production builds, and on this page the database's
 * message ("cannot drop columns from view", "lock timeout") is the whole point of the result.
 */
export function apiErrorMessage(err: unknown, fallback: string): string {
  const e = err as { response?: { data?: { message?: unknown } }; message?: unknown };
  const msg = e?.response?.data?.message;
  if (typeof msg === 'string' && msg.trim()) return msg;
  if (typeof e?.message === 'string' && e.message.trim()) return e.message;
  return fallback;
}

/** A failed apply that only lost a lock race — safe to retry once the report reading the view finishes. */
export const isLockTimeout = (message: string): boolean => /lock timeout|55P03/i.test(message);
