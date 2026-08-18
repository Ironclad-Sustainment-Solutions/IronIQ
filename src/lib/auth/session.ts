// Replaces Supabase Auth's session/JWT handling. Uses TanStack Start's
// built-in sealed (encrypted + signed) cookie session — the cookie itself
// only ever holds a pointer (sessionId) into public.app_sessions, so a
// session can be revoked server-side at any time by deleting that row.
import { useSession, getSession, updateSession, clearSession } from "@tanstack/react-start/server";
import { randomUUID } from "node:crypto";
import { withAdmin } from "@/lib/db.server";

const SESSION_COOKIE_NAME = "ironiq_session";

// Absolute ceiling: a session is invalid past this point no matter how
// recently it was used. Previously 30 days with no idle timeout at all --
// a stolen cookie stayed valid for a full month of continuous attacker
// use. 14 days is still generous for a workday tool people don't want to
// re-login to constantly, but halves the worst case.
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 14; // 14 days

// Idle timeout: a session that hasn't been used in this long is treated
// as expired even if it's well within its absolute ceiling. This is the
// part that actually matters for a stolen-cookie scenario -- an attacker
// who grabs a cookie and doesn't use it immediately (or stops using it)
// loses access within a day instead of having a month-long window.
const IDLE_TIMEOUT_SECONDS = 60 * 60 * 24; // 24 hours

// How often last_seen_at is actually written. Updating it on every single
// authenticated request (which is most requests) would mean an extra
// UPDATE per page load; throttling to once per this interval keeps the
// idle-timeout accuracy well within a reasonable margin while avoiding
// that write amplification.
const LAST_SEEN_UPDATE_THROTTLE_SECONDS = 5 * 60; // 5 minutes

type SessionData = { sessionId?: string };

function sessionConfig() {
  const password = process.env.SESSION_SECRET;
  if (!password || password.length < 32) {
    throw new Error(
      "SESSION_SECRET must be set to a random string of at least 32 characters. Generate one with: openssl rand -hex 32",
    );
  }
  return {
    password,
    name: SESSION_COOKIE_NAME,
    maxAge: SESSION_MAX_AGE_SECONDS,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      path: "/",
    },
  };
}

/** Call after verifying credentials — creates the DB session row + sets the cookie. */
export async function createUserSession(userId: string, userAgent?: string | null): Promise<void> {
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);
  const sessionId = await withAdmin(async (client) => {
    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO public.app_sessions (user_id, token_hash, user_agent, expires_at, last_seen_at)
       VALUES ($1, $2, $3, $4, now()) RETURNING id`,
      [userId, randomUUID(), userAgent ?? null, expiresAt],
    );
    return rows[0].id;
  });
  await updateSession<SessionData>(sessionConfig(), { sessionId });
}

/** Returns the logged-in user's id, or null if there's no valid session. */
export async function getSessionUserId(): Promise<string | null> {
  let session;
  try {
    session = await getSession<SessionData>(sessionConfig());
  } catch {
    return null;
  }
  const sessionId = session.data.sessionId;
  if (!sessionId) return null;

  return withAdmin(async (client) => {
    const { rows } = await client.query<{ user_id: string }>(
      `SELECT user_id FROM public.app_sessions
        WHERE id = $1
          AND expires_at > now()
          AND last_seen_at > now() - make_interval(secs => $2)`,
      [sessionId, IDLE_TIMEOUT_SECONDS],
    );
    const userId = rows[0]?.user_id;
    if (!userId) return null;

    // Throttled write: only bump last_seen_at if it's stale enough to be
    // worth the write. This still keeps the idle timeout accurate to
    // within LAST_SEEN_UPDATE_THROTTLE_SECONDS, which is a small fraction
    // of IDLE_TIMEOUT_SECONDS.
    await client.query(
      `UPDATE public.app_sessions
          SET last_seen_at = now()
        WHERE id = $1
          AND last_seen_at < now() - make_interval(secs => $2)`,
      [sessionId, LAST_SEEN_UPDATE_THROTTLE_SECONDS],
    );

    return userId;
  });
}

/** Logs out: deletes the DB session row and clears the cookie. */
export async function destroySession(): Promise<void> {
  const session = await getSession<SessionData>(sessionConfig());
  const sessionId = session.data.sessionId;
  if (sessionId) {
    await withAdmin((client) =>
      client.query(`DELETE FROM public.app_sessions WHERE id = $1`, [sessionId]),
    );
  }
  await clearSession(sessionConfig());
}

// Re-exported in case a route needs the raw session manager (rare).
export { useSession as useRawSession };
