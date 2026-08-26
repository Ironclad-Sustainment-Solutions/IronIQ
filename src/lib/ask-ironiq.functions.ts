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
 *
 * When nothing internal matches at all, this falls back to Claude's own
 * general knowledge rather than a dead end — but the response always
 * carries usedExternalKnowledge so the UI can render an unmistakably
 * different treatment for that case. An answer grounded in this app's
 * own reviewed client history and a generic AI answer with no connection
 * to it are fundamentally different kinds of trust, and conflating them
 * would be actively misleading.
 */

import { createServerFn } from "@tanstack/react-start";
import { generateText, Output } from "ai";
import { z } from "zod";
import { createAnthropicProvider } from "@/lib/ai-gateway.server";
import { requireAuth } from "@/lib/auth/auth-middleware";
import { checkAndRecordAiUsage } from "@/lib/auth/rate-limit.server";
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
    await checkAndRecordAiUsage(context.userId);
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
        origin: "engagement_derived" | "reference_library";
        distance: number;
      }[];
    });

    if (patterns.length === 0) {
      // Fallback: nothing in IronIQ's own reviewed precedent matched, so
      // answer from Claude's general knowledge instead of returning
      // nothing — but this MUST be clearly distinguishable from a
      // grounded-in-our-own-data answer, since one is verified internal
      // precedent and the other is generic AI knowledge with no
      // connection to this app's actual client history. Mixing those
      // two without a clear signal would let a generic-sounding answer
      // get mistaken for validated precedent.
      const fallback = await generateText({
        model: gateway()(MODEL),
        system: `No internal IronIQ precedent matched this question. Answer from your own
general knowledge instead, as a knowledgeable manufacturing/engineering assistant would.
Be genuinely helpful, but do not claim or imply this is based on IronIQ's own client
engagement history — it is not. If you're not confident in an accurate answer, say so
rather than guess.`,
        prompt: data.question,
      });

      return {
        answer: fallback.text,
        patterns: [],
        usedExternalKnowledge: true,
      };
    }

    const context_block = patterns
      .map(
        (p, i) =>
          `Pattern ${i + 1} [${p.product}] (${p.category_label ?? "unspecified industry"}${p.origin === "reference_library" ? ", curated reference pattern" : ", from a past engagement"}):\nProblem: ${p.pattern_summary}\nResolution: ${p.pattern_resolution ?? "(not recorded)"}\nOutcome: ${p.pattern_outcome ?? "(not recorded)"}`,
      )
      .join("\n\n");

    const result = await generateText({
      model: gateway()(MODEL),
      system: GUARDRAILS,
      prompt: `Question: ${data.question}\n\nRetrieved patterns:\n\n${context_block}`,
    });

    return { answer: result.text, patterns, usedExternalKnowledge: false };
  });
