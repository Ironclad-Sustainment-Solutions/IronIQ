import { withAdmin } from "@/lib/db.server";

/**
 * DB-backed sliding-window rate limiter for auth endpoints (login, signup).
 * Deliberately not in-memory: an in-memory counter resets on every deploy
 * or restart (trivial to defeat against a host that redeploys/restarts
 * regularly) and doesn't work correctly if this ever runs as more than one
 * instance. Every check/record happens inside withAdmin's existing
 * transaction with `SELECT ... FOR UPDATE`, so concurrent requests for the
 * same identifier serialize instead of racing past each other.
 */

export class RateLimitedError extends Error {
  constructor(public retryAfterSeconds: number) {
    const minutes = Math.ceil(retryAfterSeconds / 60);
    super(
      `Too many attempts. Please try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
    );
    this.name = "RateLimitedError";
  }
}

interface RateLimitOptions {
  /** Attempts allowed within `windowMs` before locking the identifier out. */
  maxAttempts: number;
  /** Rolling window an identifier's attempts are counted within. */
  windowMs: number;
  /** How long an identifier stays locked out once it trips the limit. */
  lockoutMs: number;
}

/**
 * Throws RateLimitedError if `identifier` is currently locked out. Callers
 * should check this *before* doing any real work (e.g. bcrypt.compare),
 * so a locked-out caller can't use the expensive path as a timing oracle
 * or to burn CPU.
 */
export async function assertNotRateLimited(identifier: string): Promise<void> {
  await withAdmin(async (client) => {
    const { rows } = await client.query<{ locked_until: string | null }>(
      "SELECT locked_until FROM public.auth_rate_limits WHERE identifier = $1 FOR UPDATE",
      [identifier],
    );
    const lockedUntil = rows[0]?.locked_until;
    if (lockedUntil && new Date(lockedUntil).getTime() > Date.now()) {
      const retryAfterSeconds = Math.ceil(
        (new Date(lockedUntil).getTime() - Date.now()) / 1000,
      );
      throw new RateLimitedError(retryAfterSeconds);
    }
  });
}

/**
 * Records a failed attempt for `identifier`, locking it out once
 * `maxAttempts` is reached within `windowMs`. Call this after a failed
 * login/signup attempt, never after a successful one.
 */
export async function recordFailedAttempt(
  identifier: string,
  { maxAttempts, windowMs, lockoutMs }: RateLimitOptions,
): Promise<void> {
  await withAdmin(async (client) => {
    const { rows } = await client.query<{
      attempt_count: number;
      window_start: string;
    }>(
      "SELECT attempt_count, window_start FROM public.auth_rate_limits WHERE identifier = $1 FOR UPDATE",
      [identifier],
    );
    const row = rows[0];
    const windowExpired =
      !row || Date.now() - new Date(row.window_start).getTime() > windowMs;

    if (windowExpired) {
      await client.query(
        `INSERT INTO public.auth_rate_limits (identifier, attempt_count, window_start, locked_until)
         VALUES ($1, 1, now(), NULL)
         ON CONFLICT (identifier) DO UPDATE
           SET attempt_count = 1, window_start = now(), locked_until = NULL`,
        [identifier],
      );
      return;
    }

    const newCount = row.attempt_count + 1;
    const lockedUntil =
      newCount >= maxAttempts ? new Date(Date.now() + lockoutMs) : null;
    await client.query(
      "UPDATE public.auth_rate_limits SET attempt_count = $2, locked_until = $3 WHERE identifier = $1",
      [identifier, newCount, lockedUntil],
    );
  });
}

/** Clears an identifier's counter, e.g. after a successful login. */
export async function clearRateLimit(identifier: string): Promise<void> {
  await withAdmin((client) =>
    client.query("DELETE FROM public.auth_rate_limits WHERE identifier = $1", [
      identifier,
    ]),
  );
}

export const LOGIN_IP_LIMIT: RateLimitOptions = {
  maxAttempts: 20,
  windowMs: 15 * 60 * 1000,
  lockoutMs: 15 * 60 * 1000,
};

export const LOGIN_EMAIL_LIMIT: RateLimitOptions = {
  maxAttempts: 8,
  windowMs: 15 * 60 * 1000,
  lockoutMs: 15 * 60 * 1000,
};

export const SIGNUP_IP_LIMIT: RateLimitOptions = {
  maxAttempts: 10,
  windowMs: 60 * 60 * 1000,
  lockoutMs: 60 * 60 * 1000,
};
