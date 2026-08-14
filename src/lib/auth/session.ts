// Replaces Supabase Auth's session/JWT handling. Uses TanStack Start's
// built-in sealed (encrypted + signed) cookie session — the cookie itself
// only ever holds a pointer (sessionId) into public.app_sessions, so a
// session can be revoked server-side at any time by deleting that row.
import { useSession, getSession, updateSession, clearSession } from "@tanstack/react-start/server";
import { randomUUID } from "node:crypto";
import { withAdmin } from "@/lib/db.server";

const SESSION_COOKIE_NAME = "ironiq_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

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
      `INSERT INTO public.app_sessions (user_id, token_hash, user_agent, expires_at)
       VALUES ($1, $2, $3, $4) RETURNING id`,
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
      `SELECT user_id FROM public.app_sessions WHERE id = $1 AND expires_at > now()`,
      [sessionId],
    );
    return rows[0]?.user_id ?? null;
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
