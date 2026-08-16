/**
 * Server-only shared plumbing for the three Bulk Intake mapping adapters
 * (mapIntakeToTemplateAssessment, mapIntakeToCapabilityAssessment,
 * mapIntakeToFieldAssessment). Split into its own `.server.ts` file rather
 * than living alongside summarizeIntakeDocument in intake-ai.functions.ts:
 * TanStack Start can only strip a file's server-only imports for the
 * client bundle when every export in that file is a createServerFn(...)
 * result. This file has none — mixing insertValidatedSuggestions (a plain
 * function that calls withUser directly) into a file that also exported
 * summarizeIntakeDocument broke that stripping and pulled db.server into
 * the client bundle. The `.server.ts` naming also means the import-
 * protection plugin itself would immediately flag any future accidental
 * client-side import of this file, rather than silently allowing it.
 */

import { withUser } from "@/lib/db.server";
import {
  isAllowedFieldPath,
  type IntakeTargetSystem,
} from "@/lib/intake-mapping";
import { z } from "zod";

/**
 * The two rules every Bulk Intake mapping adapter adds on top of its
 * target system's own GUARDRAILS string (imported from field-ai.functions.ts,
 * capability-ai.functions.ts, or defined fresh in assessment-ai.functions.ts).
 * Kept here as a single source of truth so all three adapters extend it
 * identically rather than each writing a slightly different version.
 */
export const BULK_INTAKE_EXTENSION = `
Additional rules for suggestions derived from uploaded client documents:
- Every suggested value must cite which uploaded document(s) it came from. Never suggest a
  value you cannot trace back to specific supplied document content.
- Never propose, describe, or imply Ironclad's own methodology, restoration actions, or
  "what we would do about it." You may identify that a gap or opportunity exists; how
  Ironclad would address it is for the assessor to write, never for you to draft here.
- If a document only weakly supports a value, mark it low confidence rather than omitting
  the source distinction between what the client stated and what you inferred.`;

export const IntakeSourceSchema = z.object({
  documentId: z.string().uuid(),
  category: z.enum(["evaluator_note", "company_documentation", "other"]),
  summary: z.string(),
});
export type IntakeSource = z.infer<typeof IntakeSourceSchema>;

export const RawSuggestionSchema = z.object({
  target_field_path: z.string(),
  suggested_value: z.string(),
  confidence: z.enum(["low", "moderate", "high"]),
  source_document_ids: z.array(z.string().uuid()),
});
export type RawSuggestion = z.infer<typeof RawSuggestionSchema>;

export interface InsertSuggestionsParams {
  userId: string;
  organizationId: string;
  facilityId: string;
  system: IntakeTargetSystem;
  /** Null when suggestions are generated before the assessor has opened a
   * specific assessment record — matches the nullable FK design in
   * db/schema_additions_bulk_intake.sql. */
  targetAssessmentId: string | null;
  sources: IntakeSource[];
  rawSuggestions: RawSuggestion[];
}

export interface InsertSuggestionsResult {
  inserted: number;
  rejected: { target_field_path: string; reason: string }[];
}

const TARGET_COLUMN: Record<IntakeTargetSystem, string> = {
  template_assessment: "template_assessment_id",
  cap_assessment: "cap_assessment_id",
  field_assessment: "field_assessment_id",
};

/**
 * Validates each raw model-produced suggestion against the app-layer
 * allowlist (isAllowedFieldPath) and against the actual set of source
 * document IDs supplied — a suggestion citing a document ID that was never
 * in the input is rejected rather than trusted, since a model can
 * hallucinate a citation as easily as a fact. This is defense in depth on
 * top of the database's own CHECK constraint, not a replacement for it:
 * even if this validation were skipped entirely, the DB still blocks the
 * three proprietary-methodology field paths.
 */
export async function insertValidatedSuggestions(
  params: InsertSuggestionsParams,
): Promise<InsertSuggestionsResult> {
  const knownSourceIds = new Set(params.sources.map((s) => s.documentId));
  const accepted: RawSuggestion[] = [];
  const rejected: { target_field_path: string; reason: string }[] = [];

  for (const suggestion of params.rawSuggestions) {
    if (!isAllowedFieldPath(params.system, suggestion.target_field_path)) {
      rejected.push({
        target_field_path: suggestion.target_field_path,
        reason: "Field path is not on the allowlist for this system.",
      });
      continue;
    }
    const unknownCitations = suggestion.source_document_ids.filter(
      (id) => !knownSourceIds.has(id),
    );
    if (
      unknownCitations.length > 0 ||
      suggestion.source_document_ids.length === 0
    ) {
      rejected.push({
        target_field_path: suggestion.target_field_path,
        reason:
          "Cited a document not present in the supplied source set (or cited none).",
      });
      continue;
    }
    accepted.push(suggestion);
  }

  if (accepted.length === 0) {
    return { inserted: 0, rejected };
  }

  const column = TARGET_COLUMN[params.system];

  await withUser(params.userId, async (client) => {
    for (const suggestion of accepted) {
      await client.query(
        `INSERT INTO public.intake_field_suggestions
           (organization_id, facility_id, target_system, ${column}, target_field_path,
            suggested_value, confidence, source_document_ids, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          params.organizationId,
          params.facilityId,
          params.system,
          params.targetAssessmentId,
          suggestion.target_field_path,
          suggestion.suggested_value,
          suggestion.confidence,
          suggestion.source_document_ids,
          params.userId,
        ],
      );
    }
  });

  return { inserted: accepted.length, rejected };
}

export function buildSourceContext(sources: IntakeSource[]): string {
  return sources
    .map(
      (s) => `--- Source [${s.documentId}] (${s.category}) ---\n${s.summary}`,
    )
    .join("\n\n");
}
