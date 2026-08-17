/**
 * Drafts an anonymized intelligence_patterns row from a raw
 * intelligence_events row that had contribute_consent = true. This is the
 * AI step Phase B's schema was built for — the pattern still lands at
 * 'pending_review' and is invisible to any other org until a human
 * approves it (see approveIntelligencePattern in
 * intelligence-review.functions.ts).
 *
 * Uses withAdmin (RLS-bypassing) for the actual INSERT, not withUser —
 * this runs as a trusted system action following the app-verified
 * consent flag, the same reasoning signup()/login() already use withAdmin
 * for. The calling user (whoever closed the finding/action/project) is
 * very often NOT platform staff — a customer's own facility manager
 * closing their own finding with consent checked is a completely normal
 * case — and the "insert by platform staff" RLS policy on
 * intelligence_patterns exists to stop an ordinary user from inserting a
 * pattern directly via the API, not to block this validated, server-only
 * generation step.
 */

import { generateText, Output } from "ai";
import { z } from "zod";
import { createAnthropicProvider } from "@/lib/ai-gateway.server";
import { withAdmin } from "@/lib/db.server";

const MODEL = process.env["AI_MODEL"] ?? "claude-sonnet-5";

function gateway() {
  const key = process.env["ANTHROPIC_API_KEY"];
  if (!key) throw new Error("AI assistance is not configured.");
  return createAnthropicProvider(key);
}

const GUARDRAILS = `You are drafting an ANONYMIZED version of a resolved problem, to be
shared with OTHER companies who have no relationship to the one this came from. A human
will review your draft before it is ever shown to anyone else, but draft as if it will be
published verbatim — do not rely on the reviewer to catch something you should have
removed yourself. Rules:
- Remove or generalize anything that could identify the source company: company names,
  facility names, specific part numbers, specific dollar figures, employee names, exact
  addresses or locations, and anything else specific enough to identify who this is about.
- Never invent facts, numbers, or details not present in the source material.
- Keep the technical substance intact — the point is that another company with a similar
  problem can recognize "this matches what we're seeing" and learn from the resolution,
  not to sanitize it into something useless.
- If, after removing identifying details, nothing technically useful remains, say so
  honestly rather than padding the response with generic filler.`;

export interface GeneratePatternInput {
  eventId: string;
  organizationIndustry: string | null;
  problemSummary: string;
  resolutionSummary: string | null;
  outcomeSummary: string | null;
}

/**
 * Calls the model to draft the anonymized pattern, then inserts it as
 * pending_review. Returns the new pattern's id, or null if the model
 * determined nothing useful/shareable remains after anonymization (in
 * which case nothing is inserted at all — a pattern that says "nothing
 * to share" isn't worth a reviewer's time).
 */
export async function generatePatternFromEvent(
  input: GeneratePatternInput,
): Promise<string | null> {
  const result = await generateText({
    model: gateway()(MODEL),
    system: GUARDRAILS,
    output: Output.object({
      schema: z.object({
        has_shareable_content: z.boolean(),
        category_label: z.string(),
        pattern_summary: z.string(),
        pattern_resolution: z.string().nullable(),
        pattern_outcome: z.string().nullable(),
      }),
    }),
    prompt: `Source company's industry (use this, or a more general version of it, as the
category_label — e.g. "aerospace", "automotive"; never anything more specific):
${input.organizationIndustry ?? "unknown"}

Problem: ${input.problemSummary}

Resolution: ${input.resolutionSummary ?? "(not recorded)"}

Outcome: ${input.outcomeSummary ?? "(not recorded)"}

Draft the anonymized version. Set has_shareable_content to false if nothing useful
remains after removing identifying details.`,
  });

  const draft = await result.output;
  if (!draft.has_shareable_content) return null;

  const { rows } = await withAdmin(async (client) => {
    return client.query(
      `INSERT INTO public.intelligence_patterns
         (source_event_id, product, category_label, pattern_summary, pattern_resolution, pattern_outcome, status)
       VALUES ($1, 'assessment', $2, $3, $4, $5, 'pending_review')
       RETURNING id`,
      [
        input.eventId,
        draft.category_label,
        draft.pattern_summary,
        draft.pattern_resolution,
        draft.pattern_outcome,
      ],
    );
  });
  return rows[0].id as string;
}
