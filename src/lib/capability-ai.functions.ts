/**
 * AI assistance for capability assessments.
 *
 * AI is an assistant only. Every suggestion returned here is labelled and must
 * be reviewed and approved by an assessor before it becomes an official
 * finding, root capability gap, or restoration action.
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

const GUARDRAILS = `You assist Ironclad Sustainment Solutions assessors performing a
performance-based manufacturing capability assessment. Rules you must obey:
- Never declare a root cause as established fact. If evidence is thin, say the gap is suspected and requires validation.
- Never fabricate evidence, metrics, or observations. Only use what the assessor supplied.
- Distinguish customer-stated information from validated findings.
- Judge whether capability PERFORMS well enough to support the required manufacturing outcome, not whether a document or system merely exists.
- Output is a suggestion for human review, never a decision.`;

// Exported for the same reason as field-ai.functions.ts's GUARDRAILS — Bulk
// Intake's capability-system mapping adapter extends this exact string.
export { GUARDRAILS };

const DOMAIN_CODES = [
  "technical_data",
  "digital_manufacturing",
  "production_support",
  "production_operations",
  "equipment_infrastructure",
  "workforce_knowledge",
] as const;

function gateway() {
  const key = process.env["ANTHROPIC_API_KEY"];
  if (!key) throw new Error("AI assistance is not configured.");
  return createAnthropicProvider(key);
}

const IntakeInput = z.object({
  q_greatest_impact: z.string().optional().default(""),
  q_where_when: z.string().optional().default(""),
  q_effect: z.string().optional().default(""),
  q_tried: z.string().optional().default(""),
  q_if_resolved: z.string().optional().default(""),
});

export const summarizeIntake = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => IntakeInput.parse(input))
  .handler(async ({ data }) => {
    const result = await generateText({
      model: gateway()(MODEL),
      system: GUARDRAILS,
      output: Output.object({
        schema: z.object({
          stated_problem: z.string(),
          location_process: z.string(),
          performance_impact: z.string(),
          previous_actions: z.string(),
          desired_outcome: z.string(),
          suggested_domains: z.array(z.enum(DOMAIN_CODES)),
          follow_up_questions: z.array(z.string()),
        }),
      }),
      prompt: `Summarize this customer problem intake into the five fields. The stated problem
is the customer's starting point for investigation — do NOT treat it as the root cause.
Also suggest which capability domains warrant investigation and follow-up questions the
assessor should ask.

1. Greatest impact: ${data.q_greatest_impact}
2. Where/when visible: ${data.q_where_when}
3. Effect on production/quality/cost/delivery/workforce: ${data.q_effect}
4. Already tried: ${data.q_tried}
5. If resolved: ${data.q_if_resolved}`,
    });
    return await result.output;
  });

const ConstraintInput = z.object({
  context: z.string().min(1),
});

export const suggestConstraints = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => ConstraintInput.parse(input))
  .handler(async ({ data }) => {
    const result = await generateText({
      model: gateway()(MODEL),
      system: GUARDRAILS,
      output: Output.object({
        schema: z.object({
          possible_constraints: z.array(
            z.object({
              title: z.string(),
              rationale: z.string(),
              domain_code: z.enum(DOMAIN_CODES),
              dimension: z.enum([
                "availability",
                "capability",
                "consistency",
                "control",
                "sustainability",
              ]),
              classification: z.enum([
                "primary_constraint",
                "contributing_constraint",
                "risk",
                "opportunity",
              ]),
              evidence_needed: z.string(),
            }),
          ),
          suspected_root_gap: z.string(),
          validation_required: z.boolean(),
        }),
      }),
      prompt: `Given the assessment context below, suggest which capability gaps may be
limiting performance and what evidence would validate or disprove each. Label the root
capability gap as suspected unless the supplied evidence is conclusive.

${data.context}`,
    });
    return await result.output;
  });

const ActionInput = z.object({
  gap: z.string().min(1),
  context: z.string().optional().default(""),
});

export const suggestRestorationActions = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => ActionInput.parse(input))
  .handler(async ({ data }) => {
    const result = await generateText({
      model: gateway()(MODEL),
      system: GUARDRAILS,
      output: Output.object({
        schema: z.object({
          actions: z.array(
            z.object({
              recommended_action: z.string(),
              expected_outcome: z.string(),
              metric_name: z.string(),
              unit: z.string(),
              required_resources: z.string(),
              estimated_effort: z.string(),
              dependencies: z.string(),
              validation_method: z.string(),
            }),
          ),
        }),
      }),
      prompt: `Draft restoration actions that would close this capability gap and produce a
measurable operational improvement. Each action needs a metric that can be measured before
and after.

Capability gap: ${data.gap}
Context: ${data.context}`,
    });
    return await result.output;
  });

const NarrativeInput = z.object({
  context: z.string().min(1),
});

export const draftReportNarrative = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => NarrativeInput.parse(input))
  .handler(async ({ data }) => {
    const result = await generateText({
      model: gateway()(MODEL),
      system: GUARDRAILS,
      output: Output.object({
        schema: z.object({
          executive_summary: z.string(),
          capability_assessment: z.string(),
          constraint_narrative: z.string(),
          roadmap_narrative: z.string(),
        }),
      }),
      prompt: `Draft narrative sections for an Ironclad Manufacturing Capability Review.
Emphasize operational outcomes — throughput, quality, cost, delivery, workforce — not audit
compliance. Use only the supplied material.

${data.context}`,
    });
    return await result.output;
  });

// ---------------------------------------------------------------------
// Bulk Intake: map uploaded-document summaries onto Capability Assessment
// intake fields (cap_problems, cap_performance_impacts). Extends this
// file's own GUARDRAILS with the two Bulk-Intake-specific rules, same as
// the field-assessment adapter in field-ai.functions.ts.
// cap_actions.recommended_action is excluded by the allowlist and, as a
// final backstop, by the database CHECK constraint.
// ---------------------------------------------------------------------

const MapCapInput = z.object({
  organizationId: z.string().uuid(),
  facilityId: z.string().uuid(),
  capAssessmentId: z.string().uuid().nullable().optional(),
  sources: z.array(IntakeSourceSchema).min(1),
});

export const mapIntakeToCapabilityAssessment = createServerFn({
  method: "POST",
})
  .middleware([requireAuth])
  .inputValidator((input: unknown) => MapCapInput.parse(input))
  .handler(async ({ data, context }) => {
    const result = await generateText({
      model: gateway()(MODEL),
      system: GUARDRAILS + BULK_INTAKE_EXTENSION,
      output: Output.object({
        schema: z.object({ suggestions: z.array(RawSuggestionSchema) }),
      }),
      prompt: `Propose Capability Assessment intake field values from the uploaded-document
summaries below. Only use target_field_path values from this exact list:
${ALLOWED_FIELD_PATHS.cap_assessment.join(", ")}.
Every suggestion must cite the document ID(s) (in square brackets in the source headers below)
it came from in source_document_ids. Do not draft cap_actions.recommended_action or anything
describing what Ironclad would do about a gap — that is the assessor's own analysis, never yours.

${buildSourceContext(data.sources)}`,
    });

    const output = await result.output;
    return insertValidatedSuggestions({
      userId: context.userId,
      organizationId: data.organizationId,
      facilityId: data.facilityId,
      system: "cap_assessment",
      targetAssessmentId: data.capAssessmentId ?? null,
      sources: data.sources,
      rawSuggestions: output.suggestions,
    });
  });
