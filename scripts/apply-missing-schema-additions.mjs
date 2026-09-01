// Run with: node scripts/apply-missing-schema-additions.mjs "postgres://...DATABASE_URL..."
//
// Unlike run-schema.mjs (which is explicitly for a FRESH, empty database
// only, and fails loudly if schema.sql's objects already exist), this is
// for the opposite, much more common real-world case: a database that's
// already running in production, with the base schema and MOST
// schema_additions files already applied, that just needs to catch up
// on whichever new ones have shipped since it was last updated -- e.g.
// discovering `relation "public.oauth_identities" does not exist` in
// production logs after merging a PR that added that table, with no
// clear record of exactly which of the many schema_additions files
// production already has.
//
// This is genuinely safe to run against ANY database state -- freshly
// created, fully caught up, or (the real, common case) partially
// behind -- because every individual statement that fails with a
// "this already exists" class of error (duplicate table, column, type,
// function, index, constraint, or policy) is treated as "already
// applied, skip it" rather than a fatal error, while any OTHER kind of
// failure stops the whole run immediately and reports exactly which
// file/statement caused it, since that's a real problem needing a
// person's attention, not something to silently paper over.
//
// Does NOT touch db/schema.sql itself -- this tool assumes the base
// schema is already there (true for any database that's actually
// running the app already) and only ever applies schema_additions_*.sql
// files, in the same dependency order run-schema.mjs uses.
//
// One thing confirmed by actually running this against a real
// partially-migrated test database (not assumed): most statements in
// this codebase's schema_additions files use CREATE ... IF NOT EXISTS /
// ADD COLUMN IF NOT EXISTS, which succeed silently even when the object
// already exists, rather than raising the "already exists" error this
// tool detects and skips. That means the "executed without error" count
// in this tool's output does NOT mean that many new objects were
// created on a given run -- it stays similarly high even against a
// database that's already fully caught up, since IF NOT EXISTS
// statements always report success. What actually indicates a problem
// is a "Stopped at ..." line -- that's a real, unexpected failure, not
// routine idempotent re-execution.

import { readFileSync, readdirSync } from "node:fs";
import pg from "pg";
import { splitStatements } from "./lib/sql-split.mjs";

const connectionString = process.argv[2] ?? process.env.DATABASE_URL;
if (!connectionString) {
  console.error(
    "Usage: node scripts/apply-missing-schema-additions.mjs <DATABASE_URL>\n" +
      "(or set DATABASE_URL in the environment -- e.g. this is already set for you in Render's Shell)",
  );
  process.exit(1);
}

// Postgres error codes meaning "the object this statement tries to
// create already exists" -- see https://www.postgresql.org/docs/current/errcodes-appendix.html.
// Treated as "already applied," not a failure.
const ALREADY_EXISTS_CODES = new Set([
  "42P07", // duplicate_table (also covers views/sequences)
  "42710", // duplicate_object (types, indexes, policies, triggers, etc.)
  "42701", // duplicate_column
  "42723", // duplicate_function
  "42P06", // duplicate_schema
  "42P16", // invalid_table_definition (e.g. re-adding a constraint that already exists, in some Postgres versions)
]);

function isAlreadyExists(error) {
  return (
    typeof error?.code === "string" && ALREADY_EXISTS_CODES.has(error.code)
  );
}

// Same ordering run-schema.mjs uses -- kept in sync manually since
// that's the single source of truth for dependency order between
// additions (e.g. bulk_intake_v2 builds on bulk_intake). Anything not
// listed here but present on disk is appended alphabetically as a
// safety net, matching run-schema.mjs's own fallback behavior.
const ORDERED_ADDITIONS = [
  "schema_additions_bulk_intake.sql",
  "schema_additions_bulk_intake_v2.sql",
  "schema_additions_business_development.sql",
  "schema_additions_business_development_interactions.sql",
  "schema_additions_cad_conversion.sql",
  "schema_additions_cnc_change_log.sql",
  "schema_additions_shop_floor.sql",
  "schema_additions_machine_program_parts.sql",
  "schema_additions_mtconnect_connector.sql",
  "schema_additions_machine_events.sql",
  "schema_additions_findings_machine_alarm_link.sql",
  "schema_additions_suppliers.sql",
  "schema_additions_edge_ingest_facility_auth.sql",
  "schema_additions_machine_events_tenant_isolation.sql",
  "schema_additions_machine_improvements.sql",
  "schema_additions_intelligence_layer.sql",
  "schema_additions_product_restrictions.sql",
  "schema_additions_user_approval.sql",
  "schema_additions_signup_request.sql",
  "schema_additions_auth_rate_limiting.sql",
  "schema_additions_session_idle_timeout.sql",
  "schema_additions_cap_join_indexes.sql",
  "schema_additions_intelligence_pattern_origin.sql",
  "schema_additions_intelligence_pattern_hnsw_index.sql",
  "schema_additions_intelligence_machines_product.sql",
  "schema_additions_oauth_identities.sql",
];

const dbDir = new URL("../db/", import.meta.url);
const allOnDisk = readdirSync(dbDir).filter(
  (f) => f.startsWith("schema_additions_") && f.endsWith(".sql"),
);
const extras = allOnDisk.filter((f) => !ORDERED_ADDITIONS.includes(f)).sort();
const files = [
  ...ORDERED_ADDITIONS.filter((f) => allOnDisk.includes(f)),
  ...extras,
];

const client = new pg.Client({
  connectionString,
  ssl: /localhost|127\.0\.0\.1|::1/.test(connectionString)
    ? undefined
    : { rejectUnauthorized: false },
});

await client.connect();

let totalApplied = 0;
let totalSkipped = 0;
let filesWithChanges = 0;

for (const file of files) {
  const sql = readFileSync(new URL(file, dbDir), "utf8");
  const statements = splitStatements(sql);
  let appliedInFile = 0;
  let skippedInFile = 0;

  for (const statement of statements) {
    try {
      await client.query(statement);
      appliedInFile += 1;
    } catch (error) {
      if (isAlreadyExists(error)) {
        skippedInFile += 1;
        continue;
      }
      console.error(`\nStopped at ${file}: ${error.message}`);
      console.error("Statement that failed:\n" + statement);
      await client.end();
      process.exit(1);
    }
  }

  totalApplied += appliedInFile;
  totalSkipped += skippedInFile;
  if (appliedInFile > 0) {
    filesWithChanges += 1;
    console.log(
      `${file}: ${appliedInFile} executed, ${skippedInFile} skipped (already existed)`,
    );
  } else {
    console.log(
      `${file}: already fully applied (${skippedInFile} statements skipped)`,
    );
  }
}

console.log(
  `\nDone. ${filesWithChanges} file(s) had statements execute without error ` +
    `(${totalApplied} total), ${totalSkipped} statement(s) were skipped as already existing.\n\n` +
    `Note: many statements here use CREATE ... IF NOT EXISTS / ADD COLUMN IF NOT EXISTS, ` +
    `which succeed silently even when the object already exists rather than raising the ` +
    `"already exists" error this tool otherwise detects and skips. That means the ` +
    `"executed without error" count does NOT mean that many new objects were created -- ` +
    `it's expected and safe for this number to stay similarly high even on a database ` +
    `that's already fully caught up. What actually matters: no file was reported as ` +
    `"Stopped at ..." above, and the specific thing you were missing (e.g. run ` +
    `\\d public.oauth_identities in psql) now exists.`,
);

await client.end();
