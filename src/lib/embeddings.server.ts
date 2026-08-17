/**
 * OpenAI embeddings. Originally built against Voyage AI (Anthropic's own
 * recommended embedding provider, since Anthropic doesn't offer a native
 * embeddings endpoint), but the API key obtained for this turned out to be
 * a MongoDB Atlas-issued key, not a native Voyage AI one, and Voyage AI's
 * access model apparently changed since being acquired by MongoDB in a way
 * that made a working direct integration impractical to pin down from this
 * environment. Switched providers rather than keep guessing at an
 * unverifiable integration.
 *
 * NEEDS OPENAI_API_KEY set in the environment (not VOYAGE_API_KEY anymore —
 * update Render's env vars). Also worth flagging plainly: this has not
 * been exercised against the real OpenAI API from this environment —
 * api.openai.com isn't reachable from this sandbox's network allowlist,
 * so this is implemented against OpenAI's documented REST API shape, not
 * verified live. Test this for real once deployed.
 */

const OPENAI_MODEL = "text-embedding-3-small";
// text-embedding-3-small defaults to 1536 dimensions, but OpenAI's v3
// embedding models support a `dimensions` parameter to request a smaller
// output (Matryoshka-style truncation) without needing a different model.
// Requesting 1024 here keeps this matching the existing `vector(1024)`
// column in intelligence_patterns (db/schema_additions_intelligence_layer.sql)
// exactly, so no schema migration is needed for this provider swap. If a
// different model or dimension is ever used, both need updating together.
const EXPECTED_DIMENSIONS = 1024;

export async function embedText(text: string): Promise<number[]> {
  const apiKey = process.env["OPENAI_API_KEY"];
  if (!apiKey) {
    throw new Error(
      "Embedding generation is not configured (OPENAI_API_KEY missing) — patterns will be saved without a searchable embedding until this is set.",
    );
  }

  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input: text,
      model: OPENAI_MODEL,
      dimensions: EXPECTED_DIMENSIONS,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `OpenAI embeddings request failed (${response.status}): ${body.slice(0, 300)}`,
    );
  }

  const json = (await response.json()) as { data?: { embedding: number[] }[] };
  const embedding = json.data?.[0]?.embedding;
  if (!embedding || embedding.length !== EXPECTED_DIMENSIONS) {
    throw new Error(
      `OpenAI embeddings response had unexpected shape (expected ${EXPECTED_DIMENSIONS} dimensions, got ${embedding?.length ?? "none"}).`,
    );
  }
  return embedding;
}

/** Formats a JS number array as a pgvector literal for direct use in a query. */
export function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}
