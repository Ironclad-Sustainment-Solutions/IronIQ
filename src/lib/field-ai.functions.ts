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

const MODEL = process.env["AI_MODEL"] ?? "claude-sonnet-5";

const GUARDRAILS = `You assist an Ironclad Sustainment Solutions assessor writing a PRELIMINARY
Field Capability Assessment based on a short facility walkthrough. Rules you must obey:
- Use ONLY the observations, evidence and client statements supplied. Never invent findings,
  production numbers, downtime figures, financial impact or percentages.
- Never state a root cause as confirmed. Say it appears, may be, or requires validation.
- Preserve the assessor's evidence classifications (Observed, Reported, Inferred, Requires Validation).
- Never claim the walkthrough constitutes a complete capability assessment.
- Output is a draft for assessor review, never a decision.`;

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
          evidence_class: z.enum(["Observed", "Reported", "Inferred", "Requires Validation"]),
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
