// Run with: node scripts/backfill-pattern-embeddings.mjs "postgresql://...DATABASE_URL..."
// Requires OPENAI_API_KEY in the environment (see src/lib/embeddings.server.ts
// for why OpenAI rather than Anthropic/Voyage).
//
// Finds every public.intelligence_patterns row with embedding IS NULL and
// status = 'approved' (matching the same retrieval filter
// precedent-draft.functions.ts and ask-ironiq.functions.ts already use --
// no point embedding a pending_review or rejected row before it's
// actually retrievable), computes an embedding from pattern_summary +
// pattern_resolution, and writes it back.
//
// This exists specifically for db/seed_reference_patterns.sql -- those
// curated reference patterns are inserted with embedding = NULL, since
// generating them requires a live OpenAI API call this repo's own CI/dev
// sandbox can't make (no OPENAI_API_KEY, and api.openai.com isn't
// reachable from that environment's network allowlist either). Run this
// once, anywhere with real credentials and network access, after
// applying that seed file, to make those patterns actually retrievable.
//
// IMPORTANT: this script has NOT been run against the real OpenAI API --
// written to match src/lib/embeddings.server.ts's request/response shape
// exactly, but unverified end-to-end for the same reason that file's own
// header comment flags. Test it for real once you have a working
// OPENAI_API_KEY and can reach api.openai.com.

import pg from "pg";

const connectionString = process.argv[2] ?? process.env.DATABASE_URL;
if (!connectionString) {
  console.error(
    "Usage: node scripts/backfill-pattern-embeddings.mjs <DATABASE_URL>\n" +
      "(or set DATABASE_URL in the environment)",
  );
  process.exit(1);
}

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  console.error("OPENAI_API_KEY must be set in the environment.");
  process.exit(1);
}

const OPENAI_MODEL = "text-embedding-3-small";
// Must match EXPECTED_DIMENSIONS in src/lib/embeddings.server.ts and the
// vector(1024) column in db/schema_additions_intelligence_layer.sql.
const DIMENSIONS = 1024;

async function embedText(text) {
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ input: text, model: OPENAI_MODEL, dimensions: DIMENSIONS }),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`OpenAI embeddings request failed (${response.status}): ${body.slice(0, 300)}`);
  }
  const json = await response.json();
  const embedding = json.data?.[0]?.embedding;
  if (!embedding || embedding.length !== DIMENSIONS) {
    throw new Error(
      `OpenAI embeddings response had unexpected shape (expected ${DIMENSIONS} dimensions, got ${embedding?.length ?? "none"}).`,
    );
  }
  return embedding;
}

function toVectorLiteral(embedding) {
  return `[${embedding.join(",")}]`;
}

const client = new pg.Client({
  connectionString,
  ssl: new URL(connectionString).hostname === "localhost" ? false : { rejectUnauthorized: false },
});
await client.connect();

const { rows } = await client.query(
  `SELECT id, pattern_summary, pattern_resolution
     FROM public.intelligence_patterns
    WHERE embedding IS NULL AND status = 'approved'
    ORDER BY created_at ASC`,
);

console.log(`Found ${rows.length} approved pattern(s) missing an embedding.`);

let succeeded = 0;
let failed = 0;
for (const row of rows) {
  const text = [row.pattern_summary, row.pattern_resolution].filter(Boolean).join("\n\n");
  try {
    const embedding = await embedText(text);
    await client.query(
      `UPDATE public.intelligence_patterns SET embedding = $2 WHERE id = $1`,
      [row.id, toVectorLiteral(embedding)],
    );
    succeeded += 1;
    console.log(`  embedded ${row.id}`);
  } catch (error) {
    failed += 1;
    console.error(`  FAILED ${row.id}:`, error.message);
  }
}

console.log(`Done. ${succeeded} embedded, ${failed} failed.`);
await client.end();
process.exit(failed > 0 ? 1 : 0);
