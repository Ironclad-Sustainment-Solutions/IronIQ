/**
 * "Ask IronIQ" v2 — cross-product, per Phase G. Now that CNC (Phase F)
 * writes into intelligence_events the same way Assessment (Phase C)
 * does, this searches approved patterns across every product by
 * default, optionally scoped to one if the caller wants that (e.g. "only
 * search CNC precedent"). CAD (Phase E) doesn't feed intelligence_events
 * yet — a known, not-yet-closed gap from that phase — so in practice
 * this currently searches assessment + cnc patterns; it'll pick up CAD
 * patterns automatically once that gap is closed, no change needed here.
 *
 * This only ever searches APPROVED patterns — the anonymized, reviewed
 * layer, never raw intelligence_events. Same guardrail discipline as
 * every other AI feature in this app: answer only from what was actually
 * retrieved, cite it, and say plainly when nothing relevant was found
 * rather than filling the gap with a plausible-sounding guess.
 */

import { createServerFn } from "@tanstack/react-start";
import { generateText, Output } from "ai";
import { z } from "zod";
import { createAnthropicProvider } from "@/lib/ai-gateway.server";
import { requireAuth } from "@/lib/auth/auth-middleware";
import { withUser } from "@/lib/db.server";
import { embedText, toVectorLiteral } from "@/lib/embeddings.server";

const MODEL = process.env["AI_MODEL"] ?? "claude-sonnet-5";

function gateway() {
  const key = process.env["ANTHROPIC_API_KEY"];
  if (!key) throw new Error("AI assistance is not configured.");
  return createAnthropicProvider(key);
}

const GUARDRAILS = `You are answering a question using ONLY the precedent patterns retrieved
below — each one is an anonymized record of a problem another engagement actually resolved,
already reviewed and approved for sharing. Rules:
- Answer only from what's in the retrieved patterns. Never invent a resolution, a number, or
  a detail not present in them.
- Cite which pattern(s) informed your answer by their number (e.g. "per pattern 2").
- If none of the retrieved patterns are actually relevant to the question, say so plainly —
  do not stretch a loosely-related pattern into an answer it doesn't support.
- These patterns may come from different products (Assessment, CAD, CNC) — if you draw on
  patterns from more than one, be clear about which product each came from rather than
  blending them into one undifferentiated answer.
- This is precedent, not certainty — phrase the answer as "here's how a similar problem was
  resolved elsewhere," not as a guaranteed fix for the asker's own situation.`;

const PRODUCTS = ["assessment", "cad", "cnc"] as const;

const AskInput = z.object({
  question: z.string().min(1),
  // Undefined/omitted searches across all products — this is the actual
  // Phase G behavior. Passing one narrows to just that product, for a UI
  // that wants to let someone search "just CNC precedent," for example.
  products: z.array(z.enum(PRODUCTS)).optional(),
});

const TOP_K = 5;

export const askIronIQ = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => AskInput.parse(d))
  .handler(async ({ data, context }) => {
    const queryEmbedding = await embedText(data.question);
    const queryLiteral = toVectorLiteral(queryEmbedding);
    const productFilter =
      data.products && data.products.length > 0 ? data.products : null;

    const patterns = await withUser(context.userId, async (client) => {
      const { rows } = await client.query(
        `SELECT id, product, category_label, pattern_summary, pattern_resolution, pattern_outcome,
                embedding <=> $1 AS distance
           FROM public.intelligence_patterns
          WHERE status = 'approved'
            AND embedding IS NOT NULL
            AND ($3::public.intelligence_product[] IS NULL OR product = ANY($3))
          ORDER BY distance ASC
          LIMIT $2`,
        [queryLiteral, TOP_K, productFilter],
      );
      return rows as {
        id: string;
        product: "assessment" | "cad" | "cnc";
        category_label: string | null;
        pattern_summary: string;
        pattern_resolution: string | null;
        pattern_outcome: string | null;
        distance: number;
      }[];
    });

    if (patterns.length === 0) {
      return {
        answer:
          "No relevant precedent found yet in the Intelligence Layer for this question. This is expected early on — it grows as more engagements close out findings, corrective actions, projects, and CNC changes with sharing enabled.",
        patterns: [],
      };
    }

    const context_block = patterns
      .map(
        (p, i) =>
          `Pattern ${i + 1} [${p.product}] (${p.category_label ?? "unspecified industry"}):\nProblem: ${p.pattern_summary}\nResolution: ${p.pattern_resolution ?? "(not recorded)"}\nOutcome: ${p.pattern_outcome ?? "(not recorded)"}`,
      )
      .join("\n\n");

    const result = await generateText({
      model: gateway()(MODEL),
      system: GUARDRAILS,
      prompt: `Question: ${data.question}\n\nRetrieved patterns:\n\n${context_block}`,
    });

    return { answer: result.text, patterns };
  });
