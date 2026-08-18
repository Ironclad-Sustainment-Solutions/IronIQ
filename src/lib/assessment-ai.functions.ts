/**
 * AI assistance for the template-driven Assessments system
 * (assessment_templates -> assessment_categories -> assessment_questions ->
 * assessment_responses). No AI helper existed for this system before —
 * this file's GUARDRAILS is written fresh, following the same style as
 * field-ai.functions.ts and capability-ai.functions.ts rather than
 * reusing either of theirs, since this system's shape (scored
 * question/response pairs against a published template) is genuinely
 * different from a walkthrough or a capability intake.
 */

import { createServerFn } from "@tanstack/react-start";
import { generateText, Output } from "ai";
import { z } from "zod";
import { createAnthropicProvider } from "./ai-gateway.server";
import { requireAuth } from "@/lib/auth/auth-middleware";
import { checkAndRecordAiUsage } from "@/lib/auth/rate-limit.server";
import { ALLOWED_FIELD_PATHS } from "@/lib/intake-mapping";
import {
  BULK_INTAKE_EXTENSION,
  IntakeSourceSchema,
  RawSuggestionSchema,
  insertValidatedSuggestions,
  buildSourceContext,
} from "@/lib/intake-shared.server";

const MODEL = process.env["AI_MODEL"] ?? "claude-sonnet-5";

const GUARDRAILS = `You assist Ironclad Sustainment Solutions assessors completing a
template-driven manufacturing readiness assessment. Rules you must obey:
- Never assign or suggest a numeric score (0-5) for a question — scoring is the assessor's
  judgment call, never yours, even when supporting evidence looks strong.
- Never fabricate evidence, comments, or evidence_type classifications not supported by
  what was actually supplied.
- Never state a finding, root cause, or recommended action as the assessor's own conclusion —
  that belongs in the findings table and is authored by the assessor, not by you.
- Output is a suggestion for human review, never a decision.`;

function gateway() {
  const key = process.env["ANTHROPIC_API_KEY"];
  if (!key) throw new Error("AI assistance is not configured.");
  return createAnthropicProvider(key);
}

// ---------------------------------------------------------------------
// Bulk Intake: map uploaded-document summaries onto assessment_responses
// fields (comments, evidence_description). Deliberately does NOT touch
// score — the AI should never assign a 0-5 score from documents alone —
// nor findings.recommended_action, which is excluded by the allowlist and,
// as a final backstop, by the database CHECK constraint.
// ---------------------------------------------------------------------

const MapTemplateInput = z.object({
  organizationId: z.string().uuid(),
  facilityId: z.string().uuid(),
  templateAssessmentId: z.string().uuid().nullable().optional(),
  sources: z.array(IntakeSourceSchema).min(1),
});

export const mapIntakeToTemplateAssessment = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: unknown) => MapTemplateInput.parse(input))
  .handler(async ({ data, context }) => {
    await checkAndRecordAiUsage(context.userId);
    const result = await generateText({
      model: gateway()(MODEL),
      system: GUARDRAILS + BULK_INTAKE_EXTENSION,
      output: Output.object({
        schema: z.object({ suggestions: z.array(RawSuggestionSchema) }),
      }),
      prompt: `Propose assessment_responses field values from the uploaded-document summaries
below. Only use target_field_path values from this exact list:
${ALLOWED_FIELD_PATHS.template_assessment.join(", ")}.
Never suggest a score. Every suggestion must cite the document ID(s) (in square brackets in
the source headers below) it came from in source_document_ids. Do not draft
findings.recommended_action or anything describing what Ironclad would do about a gap —
that is the assessor's own analysis, never yours.

${buildSourceContext(data.sources)}`,
    });

    const output = await result.output;
    return insertValidatedSuggestions({
      userId: context.userId,
      organizationId: data.organizationId,
      facilityId: data.facilityId,
      system: "template_assessment",
      targetAssessmentId: data.templateAssessmentId ?? null,
      sources: data.sources,
      rawSuggestions: output.suggestions,
    });
  });
