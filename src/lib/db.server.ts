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
      ssl: connectionString.includes("localhost") ? false : { rejectUnauthorized: false },
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
    await client.query("SELECT set_config('app.current_user_id', $1, true)", [userId ?? ""]);
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
export async function withAdmin<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
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

/**
 * Run queries with full access, bypassing RLS — equivalent to Supabase's
 * service_role / supabaseAdmin. Only use for trusted server-side operations
 * (signup, session management, admin tooling), never based on user input.
 */
export function withAdmin<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  return withRole("app_admin", null, fn);
}
