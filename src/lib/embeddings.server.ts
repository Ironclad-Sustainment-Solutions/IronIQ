/**
 * Voyage AI embeddings — Anthropic's own recommended embedding provider,
 * since Anthropic doesn't offer a native embeddings endpoint. This app has
 * no embeddings capability before this file.
 *
 * NEEDS VOYAGE_API_KEY set in the environment. Also worth flagging plainly:
 * this has not been exercised against the real Voyage API from this
 * environment — api.voyageai.com isn't reachable from this sandbox's
 * network allowlist, so this is implemented against Voyage's documented
 * REST API shape, not verified live. Test this for real once a key exists.
 */

const VOYAGE_MODEL = "voyage-3";
// voyage-3's default output dimension — must match the `vector(1024)`
// column in intelligence_patterns (db/schema_additions_intelligence_layer.sql).
// If a different Voyage model or dimension is ever used, both need updating
// together.
const EXPECTED_DIMENSIONS = 1024;

export async function embedText(text: string): Promise<number[]> {
  const apiKey = process.env["VOYAGE_API_KEY"];
  if (!apiKey) {
    throw new Error(
      "Embedding generation is not configured (VOYAGE_API_KEY missing) — patterns will be saved without a searchable embedding until this is set.",
    );
  }

  const response = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ input: [text], model: VOYAGE_MODEL }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `Voyage embeddings request failed (${response.status}): ${body.slice(0, 300)}`,
    );
  }

  const json = (await response.json()) as { data?: { embedding: number[] }[] };
  const embedding = json.data?.[0]?.embedding;
  if (!embedding || embedding.length !== EXPECTED_DIMENSIONS) {
    throw new Error(
      `Voyage embeddings response had unexpected shape (expected ${EXPECTED_DIMENSIONS} dimensions, got ${embedding?.length ?? "none"}).`,
    );
  }
  return embedding;
}

/** Formats a JS number array as a pgvector literal for direct use in a query. */
export function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}
