// Replaces src/integrations/supabase/client.ts and client.server.ts.
//
// The app connects to Postgres as a single low-privilege login role (whatever
// DATABASE_URL specifies), then switches into either `app_user` (RLS-enforced,
// same as Supabase's `authenticated`) or `app_admin` (bypasses RLS, same as
// Supabase's `service_role`) for the duration of each request/transaction —
// exactly mirroring how Supabase split those two roles.
import { Pool, type PoolClient } from "pg";

function getPool(): Pool {
  const g = globalThis as unknown as { __pgPool?: Pool };
  if (!g.__pgPool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error(
        "Missing DATABASE_URL environment variable. Set it to your Render Postgres connection string.",
      );
    }
    g.__pgPool = new Pool({
      connectionString,
      // Render's managed Postgres requires SSL; rejectUnauthorized:false matches
      // Render's own connection examples since it uses a Render-issued cert chain.
      ssl: connectionString.includes("localhost")
        ? false
        : { rejectUnauthorized: false },
      // Previously unset, silently defaulting to node-pg's max: 10 — genuinely
      // easy to exhaust given how many pages here fire several parallel
      // useQuery calls at once (each is its own server function, each
      // acquiring its own pool connection). Worth tuning against your actual
      // Render Postgres plan's connection limit if this still isn't enough.
      max: 20,
      // Also previously unset, which defaults to 0 — meaning a request
      // waiting for a free connection under exhaustion would hang
      // indefinitely rather than fail with a clear, catchable error. An
      // explicit timeout turns silent hangs into loud, diagnosable failures.
      connectionTimeoutMillis: 10_000,
    });

    // Without this, an idle client encountering ANY error (the database
    // closing a stale connection, a brief network blip) crashes the
    // entire Node process, not just the current request — a severe,
    // well-documented node-pg pitfall. This is likely the actual
    // explanation for intermittent, seemingly-random failures across
    // many different pages: it isn't a per-page bug at all, it's the
    // whole server crashing and restarting, so whichever page anyone
    // happened to be loading at that moment fails.
    g.__pgPool.on("error", (err) => {
      console.error("Postgres pool: unexpected error on idle client", err);
    });
  }
  return g.__pgPool;
}

async function withRole<T>(
  role: "app_user" | "app_admin",
  userId: string | null,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`SET LOCAL ROLE ${role}`);
    // set_config(..., true) scopes the setting to this transaction only
    // (equivalent to SET LOCAL, but works with a bind parameter).
    await client.query("SELECT set_config('app.current_user_id', $1, true)", [
      userId ?? "",
    ]);
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Run queries as the current authenticated user, with RLS enforced exactly
 * like Supabase's `authenticated` role + `auth.uid()` did.
 * Use inside server functions that already have `userId` from requireAuth.
 */
export function withUser<T>(
  userId: string,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  return withRole("app_user", userId, fn);
}

/**
 * Run queries with full access, bypassing RLS — equivalent to Supabase's
 * service_role / supabaseAdmin. Only use for trusted server-side operations
 * (signup, session management, admin tooling), never based on user input.
 *
 * Implementation note: Render's managed Postgres doesn't allow granting the
 * BYPASSRLS attribute to a non-superuser role, so instead of switching into a
 * special app_admin role, this simply avoids switching roles at all — the
 * connecting login role owns every table (it's the one that ran schema.sql),
 * and Postgres automatically exempts table owners from RLS.
 */
export async function withAdmin<T>(
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}
