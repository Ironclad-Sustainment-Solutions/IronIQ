/**
 * AI assistance for the Field Capability Assessment.
 *
 * The model only reworks material the assessor actually recorded. It must not
 * invent observations, production numbers, financial impact or confirmed root
 * causes, and it never marks a finding validated.
 */

import { createServerFn } from "@tanstack/react-start";
import { generateText, Output } from "ai";
import { z } from "zod";
import { createAnthropicProvider } from "./ai-gateway.server";
import { requireAuth } from "@/lib/auth/auth-middleware";
import { ALLOWED_FIELD_PATHS } from "@/lib/intake-mapping";
import {
  BULK_INTAKE_EXTENSION,
  IntakeSourceSchema,
  RawSuggestionSchema,
  insertValidatedSuggestions,
  buildSourceContext,
} from "@/lib/intake-ai.functions";

const MODEL = process.env["AI_MODEL"] ?? "claude-sonnet-5";

const GUARDRAILS = `You assist an Ironclad Sustainment Solutions assessor writing a PRELIMINARY
Field Capability Assessment based on a short facility walkthrough. Rules you must obey:
- Use ONLY the observations, evidence and client statements supplied. Never invent findings,
  production numbers, downtime figures, financial impact or percentages.
- Never state a root cause as confirmed. Say it appears, may be, or requires validation.
- Preserve the assessor's evidence classifications (Observed, Reported, Inferred, Requires Validation).
- Never claim the walkthrough constitutes a complete capability assessment.
- Output is a draft for assessor review, never a decision.`;

// Exported so intake-ai.functions.ts (Bulk Intake) can extend this exact
// string rather than duplicating it — the two extra rules for document-
// derived suggestions (cite sources, never propose Ironclad's own
// methodology) live there, not here, so this file's own AI helpers are
// unaffected.
export { GUARDRAILS };

function gateway() {
  const key = process.env["ANTHROPIC_API_KEY"];
  if (!key) throw new Error("AI assistance is not configured.");
  return createAnthropicProvider(key);
}

const SummaryInput = z.object({ context: z.string().min(1).max(24000) });

export const draftFieldExecutiveSummary = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => SummaryInput.parse(input))
  .handler(async ({ data }) => {
    const result = await generateText({
      model: gateway()(MODEL),
      system: GUARDRAILS,
      output: Output.object({
        schema: z.object({
          executive_summary: z.string(),
          what_client_told_us: z.string(),
          what_ironclad_observed: z.string(),
          most_significant_gaps: z.string(),
          connected_production_impact: z.string(),
          where_ironclad_could_help: z.string(),
          validate_in_full_assessment: z.array(z.string()),
        }),
      }),
      prompt: `Draft the executive summary of this preliminary Field Capability Assessment from the
recorded material below. Answer: what did the client tell us, what did Ironclad observe, which
capability gaps appear most significant, what production impact appears connected, where could
Ironclad help, and what should be validated in a full IronIQ Capability Assessment.

${data.context}`,
    });
    return await result.output;
  });

const NoteInput = z.object({
  note: z.string().min(1).max(6000),
  domains: z.array(z.string()).default([]),
});

export const cleanFieldNote = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => NoteInput.parse(input))
  .handler(async ({ data }) => {
    const result = await generateText({
      model: gateway()(MODEL),
      system: GUARDRAILS,
      output: Output.object({
        schema: z.object({
          observed_condition: z.string(),
          objective_evidence: z.string(),
          suggested_domain: z.string(),
          suggested_category: z.string(),
          suggested_gap_statement: z.string(),
          evidence_class: z.enum([
            "Observed",
            "Reported",
            "Inferred",
            "Requires Validation",
          ]),
          questions_for_full_assessment: z.array(z.string()),
        }),
      }),
      prompt: `Clean up this raw shop-floor note into assessment language without adding any
information that is not present. Suggest which capability domain it belongs to (choose from:
${data.domains.join(", ")}) and a category name.

Raw note: ${data.note}`,
    });
    return await result.output;
  });

const ValidationInput = z.object({ finding: z.string().min(1).max(6000) });

/** Questions the assessor should ask the client to validate a preliminary finding. */
export const suggestValidationQuestions = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => ValidationInput.parse(input))
  .handler(async ({ data }) => {
    const result = await generateText({
      model: gateway()(MODEL),
      system: GUARDRAILS,
      output: Output.object({
        schema: z.object({
          questions: z.array(z.string()),
          data_requirements: z.array(z.string()),
        }),
      }),
      prompt: `Draft 3-5 short, non-leading questions the Ironclad assessor should ask the client at the
findings review meeting to validate this preliminary finding, plus the specific data, records or access
that would be required to validate it. Never assert a root cause.

${data.finding}`,
    });
    return await result.output;
  });

const BridgeInput = z.object({ gap: z.string().min(1).max(6000) });

export const draftIroncladBridge = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => BridgeInput.parse(input))
  .handler(async ({ data }) => {
    const result = await generateText({
      model: gateway()(MODEL),
      system: GUARDRAILS,
      output: Output.object({
        schema: z.object({
          current_state: z.string(),
          capability_gap: z.string(),
          capability_needed: z.string(),
          potential_ironclad_action: z.string(),
          expected_operational_result: z.string(),
        }),
      }),
      prompt: `Draft the Ironclad Bridge statements for this capability gap. Keep the expected
result qualitative — never promise a percentage or dollar figure.

${data.gap}`,
    });
    return await result.output;
  });

// ---------------------------------------------------------------------
// Bulk Intake: map uploaded-document summaries onto Field Assessment
// fields. Extends this file's own GUARDRAILS with the two Bulk-Intake-
// specific rules (cite sources, never draft ironclad_action/response —
// see BULK_INTAKE_EXTENSION) rather than writing a fourth guardrail
// variant. field_gaps.ironclad_action and field_constraints.ironclad_response
// are excluded both by the allowlist in intake-mapping.ts and, as a final
// backstop, by the database CHECK constraint itself.
// ---------------------------------------------------------------------

const MapFieldInput = z.object({
  organizationId: z.string().uuid(),
  facilityId: z.string().uuid(),
  fieldAssessmentId: z.string().uuid().nullable().optional(),
  sources: z.array(IntakeSourceSchema).min(1),
});

export const mapIntakeToFieldAssessment = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: unknown) => MapFieldInput.parse(input))
  .handler(async ({ data, context }) => {
    const result = await generateText({
      model: gateway()(MODEL),
      system: GUARDRAILS + BULK_INTAKE_EXTENSION,
      output: Output.object({
        schema: z.object({ suggestions: z.array(RawSuggestionSchema) }),
      }),
      prompt: `Propose Field Assessment field values from the uploaded-document summaries below.
Only use target_field_path values from this exact list: ${ALLOWED_FIELD_PATHS.field_assessment.join(", ")}.
Every suggestion must cite the document ID(s) (in square brackets in the source headers below)
it came from in source_document_ids. Do not draft field_gaps.ironclad_action,
field_constraints.ironclad_response, or anything describing what Ironclad would do about a
gap — that is the assessor's own analysis, never yours.

${buildSourceContext(data.sources)}`,
    });

    const output = await result.output;
    return insertValidatedSuggestions({
      userId: context.userId,
      organizationId: data.organizationId,
      facilityId: data.facilityId,
      system: "field_assessment",
      targetAssessmentId: data.fieldAssessmentId ?? null,
      sources: data.sources,
      rawSuggestions: output.suggestions,
    });
  });
