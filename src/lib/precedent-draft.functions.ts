/**
 * AI feature (Option 2): drafts a suggested resolution — a corrective
 * action's action_description, or a CNC change log entry's
 * change_description — grounded strictly in approved Intelligence Layer
 * patterns. Shared by both call sites (entity-dialogs.tsx's
 * CorrectiveActionDialog and cnc.tsx's log form) rather than duplicated,
 * since the actual mechanism (embed problem -> retrieve nearest approved
 * patterns -> draft from ONLY those, citing them) is identical; only the
 * field being drafted and the calling UI differ.
 *
 * Deliberately narrower than Ask IronIQ's free-form answer: this either
 * drafts real suggested text grounded in specific cited patterns, or
 * returns null (no draft) when nothing genuinely relevant exists — it
 * does not pad out a generic, non-committal suggestion just to have
 * something to show. A vague AI suggestion with no real precedent behind
 * it is worse than no suggestion at all, since it looks authoritative
 * without being grounded in anything.
 */

import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
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

const NO_PRECEDENT_MARKER = "NO_RELEVANT_PRECEDENT";

const GUARDRAILS = `You are drafting a SUGGESTED resolution for a new problem, grounded ONLY in
the specific precedent patterns retrieved below — each is an anonymized record of a problem
another engagement actually resolved, already reviewed and approved for sharing. Rules:
- Draft ONLY from what's in the retrieved patterns. Never invent a resolution, a number, or a
  step not supported by them.
- Cite which pattern(s) you drew from directly in the draft text (e.g. "per pattern 2").
- If none of the retrieved patterns are genuinely relevant to THIS specific problem, do not
  stretch a loosely-related one into a suggestion — respond with exactly the text
  "${NO_PRECEDENT_MARKER}" and nothing else. A vague suggestion with no real precedent behind
  it is worse than no suggestion.
- This is a draft for a human to review and edit, not a finished answer — phrase it as a
  starting point, not a guaranteed fix.
- Keep it to 2-4 sentences.`;

const DraftInput = z.object({
  problemDescription: z.string().min(1),
  fieldLabel: z.string().min(1),
  products: z.array(z.enum(["assessment", "cad", "cnc"])).optional(),
});

const TOP_K = 3;

export const draftFromPrecedent = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => DraftInput.parse(d))
  .handler(async ({ data, context }) => {
    await checkAndRecordAiUsage(context.userId);
    const queryEmbedding = await embedText(data.problemDescription);
    const queryLiteral = toVectorLiteral(queryEmbedding);
    const productFilter =
      data.products && data.products.length > 0 ? data.products : null;

    const patterns = await withUser(context.userId, async (client) => {
      const { rows } = await client.query(
        `SELECT id, product, category_label, pattern_summary, pattern_resolution,
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
        distance: number;
      }[];
    });

    if (patterns.length === 0) {
      return { draft: null, patterns: [] };
    }

    const context_block = patterns
      .map(
        (p, i) =>
          `Pattern ${i + 1} [${p.product}] (${p.category_label ?? "unspecified industry"}):\nProblem: ${p.pattern_summary}\nResolution: ${p.pattern_resolution ?? "(not recorded)"}`,
      )
      .join("\n\n");

    const result = await generateText({
      model: gateway()(MODEL),
      system: GUARDRAILS,
      prompt: `New problem: ${data.problemDescription}\n\nDraft a suggested ${data.fieldLabel} for this new problem, grounded only in the retrieved patterns below.\n\nRetrieved patterns:\n\n${context_block}`,
    });

    if (result.text.trim() === NO_PRECEDENT_MARKER) {
      return { draft: null, patterns };
    }
    return { draft: result.text, patterns };
  });
