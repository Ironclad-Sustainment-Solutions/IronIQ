/**
 * Bulk Intake — shared, system-agnostic AI step: summarizes one parsed
 * document into structured facts before any of the three per-system mapping
 * adapters (mapIntakeToTemplateAssessment in assessment-ai.functions.ts,
 * mapIntakeToCapabilityAssessment in capability-ai.functions.ts,
 * mapIntakeToFieldAssessment in field-ai.functions.ts) consume it.
 *
 * This step doesn't know or care which assessment system will use its
 * output — it only extracts what's actually present in the document text,
 * tagged by the document's category so an evaluator's anecdote is never
 * silently blended into "documented company process."
 */

import { createServerFn } from "@tanstack/react-start";
import { generateText, Output } from "ai";
import { z } from "zod";
import { createAnthropicProvider } from "./ai-gateway.server";
import { requireAuth } from "@/lib/auth/auth-middleware";
import { checkAndRecordAiUsage } from "@/lib/auth/rate-limit.server";
import { withUser } from "@/lib/db.server";

const MODEL = process.env["AI_MODEL"] ?? "claude-sonnet-5";

function gateway() {
  const key = process.env["ANTHROPIC_API_KEY"];
  if (!key) throw new Error("AI assistance is not configured.");
  return createAnthropicProvider(key);
}

const SUMMARY_GUARDRAILS = `You are extracting facts from a single document uploaded during an
Ironclad Sustainment Solutions client visit, before any assessment scoring happens. Rules:
- Extract ONLY what the document actually states. Never infer, extrapolate, or fill gaps.
- If the document is an evaluator's personal note or anecdote (not company documentation),
  say so explicitly — do not present opinion as documented fact.
- Do not draft findings, scores, or recommendations. This is raw extraction only.`;

const SummarizeInput = z.object({
  documentId: z.string().uuid(),
});

export const summarizeIntakeDocument = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => SummarizeInput.parse(d))
  .handler(async ({ data, context }) => {
    await checkAndRecordAiUsage(context.userId);
    const doc = await withUser(context.userId, async (client) => {
      const { rows } = await client.query(
        `SELECT d.category, d.original_filename, e.extracted_text
           FROM public.intake_documents d
           JOIN public.intake_extractions e ON e.document_id = d.id
          WHERE d.id = $1
          ORDER BY e.created_at DESC
          LIMIT 1`,
        [data.documentId],
      );
      if (rows.length === 0) {
        throw new Error(
          "No extracted text found for this document — has it been parsed yet?",
        );
      }
      return rows[0] as {
        category: string;
        original_filename: string;
        extracted_text: string;
      };
    });

    if (!doc.extracted_text.trim()) {
      return {
        documentId: data.documentId,
        keyFacts: [],
        statedMetrics: [],
        processDescriptions: [],
        isOpinionOrAnecdote: doc.category === "evaluator_note",
        summary: "Document contained no extractable text.",
      };
    }

    const result = await generateText({
      model: gateway()(MODEL),
      system: SUMMARY_GUARDRAILS,
      output: Output.object({
        schema: z.object({
          key_facts: z.array(z.string()),
          stated_metrics: z.array(z.string()),
          process_descriptions: z.array(z.string()),
          mentioned_equipment_or_certifications: z.array(z.string()),
          is_opinion_or_anecdote: z.boolean(),
          summary: z.string(),
        }),
      }),
      prompt: `Document category: ${doc.category} (file: "${doc.original_filename}").

Extract facts from this document text. If category is "evaluator_note", treat its contents as
one person's observations/anecdotes, not verified company documentation, and set
is_opinion_or_anecdote accordingly.

${doc.extracted_text.slice(0, 20000)}`,
    });

    return { documentId: data.documentId, ...(await result.output) };
  });
