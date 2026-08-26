// Run with: node run-schema.mjs "postgres://...external-url..."
// Loads db/schema.sql AND every db/schema_additions_*.sql file, then grants
// the connecting role app_user/app_admin.
//
// Intended for a FRESH, empty database only. db/schema.sql's own
// CREATE TABLE statements have no IF NOT EXISTS guard, so re-running this
// against a database that's already been set up fails loudly with a clear
// Postgres "relation already exists" error rather than silently
// re-applying or corrupting anything -- that's the correct failure mode
// for a one-time setup tool, just noting it here so it isn't a surprise.
//
// Two independent bugs fixed here:
//
// 1. Previously this only applied db/schema.sql, which is the base schema
//    only -- bulk intake, business development, CAD conversion, CNC change
//    log, the pgvector intelligence layer, product access restrictions,
//    user approval, login/signup rate limiting, and session idle-timeout
//    tracking all live in separate schema_additions_*.sql files. Anyone
//    running this tool (or the "Load database schema" GitHub Action that
//    wraps it) got a database with entire feature areas' tables missing.
//
// 2. This tool never actually worked against a genuinely fresh database.
//    db/schema.sql does `ALTER TYPE app_role ADD VALUE 'project_manager'`
//    and then uses that value (`'project_manager'::app_role`) later in the
//    same file. That's fine via `psql -f schema.sql`, which autocommits
//    each top-level statement by default -- but this script previously sent
//    the entire file as one string to node-pg's client.query(), and
//    Postgres's simple query protocol treats a multi-statement string as
//    one implicit transaction. New enum values can't be used before the
//    transaction that added them commits, so this failed with "unsafe use
//    of new value... New enum values must be committed before they can be
//    used" every single time on a fresh database. Fixed by splitting each
//    file into individual top-level statements (respecting dollar-quoted
//    function bodies, string literals, and comments) and executing them
//    one at a time, matching psql's actual per-statement autocommit
//    behavior instead of accidentally wrapping the whole file in one
//    transaction.
import { readFileSync, readdirSync } from "node:fs";
import pg from "pg";

const connectionString = process.argv[2];
if (!connectionString) {
  console.error("Usage: node run-schema.mjs <DATABASE_URL>");
  process.exit(1);
}

/**
 * Splits a SQL script into individual top-level statements, the same way
 * psql effectively does when running each one as its own implicit
 * transaction. Naive splitting on `;` breaks inside dollar-quoted function
 * bodies (`$$ ... $$` or `$tag$ ... $tag$`), which this schema uses
 * throughout for functions and triggers -- this tracks quoting state
 * properly instead.
 */
function splitStatements(sql) {
  const statements = [];
  let current = "";
  let i = 0;
  const n = sql.length;

  while (i < n) {
    const ch = sql[i];

    // Line comment: copy through to end of line untouched.
    if (ch === "-" && sql[i + 1] === "-") {
      const end = sql.indexOf("\n", i);
      const stop = end === -1 ? n : end + 1;
      current += sql.slice(i, stop);
      i = stop;
      continue;
    }

    // Block comment (non-nested -- sufficient for this schema's usage).
    if (ch === "/" && sql[i + 1] === "*") {
      const end = sql.indexOf("*/", i + 2);
      const stop = end === -1 ? n : end + 2;
      current += sql.slice(i, stop);
      i = stop;
      continue;
    }

    // Single-quoted string literal, with '' as the escape for a literal quote.
    if (ch === "'") {
      let j = i + 1;
      while (j < n) {
        if (sql[j] === "'" && sql[j + 1] === "'") {
          j += 2;
          continue;
        }
        if (sql[j] === "'") {
          j += 1;
          break;
        }
        j += 1;
      }
      current += sql.slice(i, j);
      i = j;
      continue;
    }

    // Double-quoted identifier.
    if (ch === '"') {
      let j = i + 1;
      while (j < n && sql[j] !== '"') j += 1;
      j = Math.min(j + 1, n);
      current += sql.slice(i, j);
      i = j;
      continue;
    }

    // Dollar-quoted string: $$ ... $$ or $tag$ ... $tag$.
    if (ch === "$") {
      const tagMatch = /^\$[a-zA-Z_]*\$/.exec(sql.slice(i));
      if (tagMatch) {
        const tag = tagMatch[0];
        const closeIdx = sql.indexOf(tag, i + tag.length);
        const stop = closeIdx === -1 ? n : closeIdx + tag.length;
        current += sql.slice(i, stop);
        i = stop;
        continue;
      }
    }

    // Top-level statement terminator.
    if (ch === ";") {
      current += ch;
      const trimmed = current.trim();
      if (trimmed.length > 0) statements.push(trimmed);
      current = "";
      i += 1;
      continue;
    }

    current += ch;
    i += 1;
  }

  const trimmedTail = current.trim();
  if (trimmedTail.length > 0) statements.push(trimmedTail);
  return statements;
}

async function applyFile(client, label, sql) {
  console.log(`Applying ${label} ...`);
  const statements = splitStatements(sql);
  for (const statement of statements) {
    await client.query(statement);
  }
  console.log(`  applied (${statements.length} statements).`);
}

// Fixed dependency order -- some additions reference tables/functions
// created by earlier ones (e.g. bulk_intake_v2 builds on bulk_intake).
// Anything not explicitly listed here but matching schema_additions_*.sql
// is appended afterward in alphabetical order as a safety net, so a new
// file added later without updating this list still gets applied (just
// without a guaranteed-correct position relative to the others).
const ORDERED_ADDITIONS = [
  "schema_additions_bulk_intake.sql",
  "schema_additions_bulk_intake_v2.sql",
  "schema_additions_business_development.sql",
  "schema_additions_business_development_interactions.sql",
  "schema_additions_cad_conversion.sql",
  "schema_additions_cnc_change_log.sql",
  "schema_additions_intelligence_layer.sql",
  "schema_additions_product_restrictions.sql",
  "schema_additions_user_approval.sql",
  "schema_additions_auth_rate_limiting.sql",
  "schema_additions_session_idle_timeout.sql",
  "schema_additions_cap_join_indexes.sql",
  "schema_additions_intelligence_pattern_origin.sql",
  "schema_additions_intelligence_pattern_hnsw_index.sql",
];

const dbDir = new URL("./db/", import.meta.url);
const allAdditionsOnDisk = readdirSync(dbDir).filter(
  (f) => f.startsWith("schema_additions_") && f.endsWith(".sql"),
);
const unlisted = allAdditionsOnDisk.filter(
  (f) => !ORDERED_ADDITIONS.includes(f),
);
const filesToApply = [
  ...ORDERED_ADDITIONS.filter((f) => allAdditionsOnDisk.includes(f)),
  ...unlisted.sort(),
];

if (unlisted.length > 0) {
  console.warn(
    `Warning: found schema_additions file(s) not in ORDERED_ADDITIONS: ${unlisted.join(", ")}. ` +
      "Applying them last, alphabetically -- add them to the ordered list in this script if they have real dependencies on other additions files.",
  );
}

// SSL is enabled by default for remote hosts (Render's managed Postgres
// requires it for external connections) but explicitly disabled for
// localhost/loopback -- a vanilla local Postgres or CI service container
// (e.g. the pgvector/pgvector:pg16 image used in .github/workflows/ci.yml)
// does not have SSL configured at all by default, and node-pg's `ssl`
// option does NOT gracefully fall back to plaintext the way psql's
// default sslmode=prefer does: setting `ssl: {...}` at all forces an SSL
// handshake, and if the server doesn't support one, the connection fails
// outright with "The server does not support SSL connections". This was
// a real, reproduced bug -- confirmed locally by disabling SSL on a
// Postgres instance and hitting the exact same error message CI reported.
function shouldUseSsl(connString) {
  let host;
  try {
    host = new URL(connString).hostname;
  } catch {
    return true; // unparseable -- default to the safer (remote-friendly) behavior
  }
  return !["localhost", "127.0.0.1", "::1"].includes(host);
}

const client = new pg.Client({
  connectionString,
  ssl: shouldUseSsl(connectionString) ? { rejectUnauthorized: false } : false,
});
await client.connect();

const baseSchema = readFileSync(
  new URL("./db/schema.sql", import.meta.url),
  "utf8",
);
await applyFile(client, "db/schema.sql", baseSchema);

for (const file of filesToApply) {
  const sql = readFileSync(new URL(`./db/${file}`, import.meta.url), "utf8");
  try {
    await applyFile(client, `db/${file}`, sql);
  } catch (error) {
    if (file === "schema_additions_intelligence_layer.sql") {
      console.error(
        `  FAILED applying ${file} -- this file requires the pgvector "vector" ` +
          "extension. Confirm it's enabled on your Postgres plan/instance before retrying.",
      );
    }
    throw error;
  }
}

console.log("Granting app_user/app_admin to the connection role ...");
const { rows } = await client.query("SELECT current_user");
const connUser = rows[0].current_user;
await client.query(`GRANT app_user, app_admin TO "${connUser}"`);
console.log(`Granted to "${connUser}".`);

await client.end();
console.log("Done.");
