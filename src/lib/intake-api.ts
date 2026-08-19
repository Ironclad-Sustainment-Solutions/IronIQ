/**
 * Bulk Intake data layer. Every read and write goes through server functions
 * (src/lib/intake.functions.ts, src/lib/intake-ai.functions.ts, plus the
 * three per-system mapping adapters), which enforce RLS — same pattern as
 * field-capture-api.ts.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import * as intakeFn from "@/lib/intake.functions";
import { summarizeIntakeDocument } from "@/lib/intake-ai.functions";
import { mapIntakeToTemplateAssessment } from "@/lib/assessment-ai.functions";
import { mapIntakeToCapabilityAssessment } from "@/lib/capability-ai.functions";
import { mapIntakeToFieldAssessment } from "@/lib/field-ai.functions";

export type IntakeCategory =
  "evaluator_note" | "company_documentation" | "other";
export type IntakeTargetSystem =
  "template_assessment" | "cap_assessment" | "field_assessment";

export interface IntakeDocumentRow {
  id: string;
  original_filename: string;
  mime_type: string | null;
  byte_size: number;
  category: IntakeCategory;
  status: "uploaded" | "parsing" | "parsed" | "failed";
  failure_reason: string | null;
  storage_path: string;
  created_at: string;
}

export interface IntakeSuggestionRow {
  id: string;
  target_system: IntakeTargetSystem;
  template_assessment_id: string | null;
  cap_assessment_id: string | null;
  field_assessment_id: string | null;
  target_field_path: string;
  suggested_value: string;
  confidence: "low" | "moderate" | "high";
  source_document_ids: string[];
  status: "suggested" | "accepted" | "edited" | "rejected";
  created_at: string;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      resolve((reader.result as string).split(",")[1] ?? "");
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

export function useIntakeDocuments(facilityId?: string | null) {
  return useQuery({
    queryKey: ["intake-documents", facilityId],
    enabled: Boolean(facilityId),
    refetchInterval: (query) => {
      // Poll while anything is still uploading/parsing so status badges
      // update without the assessor needing to manually refresh.
      const rows = (query.state.data as IntakeDocumentRow[] | undefined) ?? [];
      const stillWorking = rows.some(
        (r) => r.status === "uploaded" || r.status === "parsing",
      );
      return stillWorking ? 2000 : false;
    },
    queryFn: () =>
      intakeFn.listIntakeDocuments({
        data: { facilityId: facilityId as string },
      }) as Promise<IntakeDocumentRow[]>,
  });
}

export function useUploadIntakeDocument(
  organizationId?: string | null,
  facilityId?: string | null,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      file,
      category,
    }: {
      file: File;
      category: IntakeCategory;
    }) => {
      if (!organizationId || !facilityId)
        throw new Error("Select an organization and facility first.");
      const fileBase64 = await fileToBase64(file);
      const uploadResult = await intakeFn.createIntakeUpload({
        data: {
          organizationId,
          facilityId,
          fileName: file.name,
          fileBase64,
          contentType: file.type || undefined,
          category,
        },
      });
      // Kick off parsing immediately — the assessor shouldn't need a
      // separate "parse" click for every file in a batch upload.
      await intakeFn
        .parseIntakeDocument({ data: { documentId: uploadResult.documentId } })
        .catch(() => {
          // Parse failures are surfaced via the document's own status/
          // failure_reason column (polled by useIntakeDocuments), not as a
          // toast here — one failed file in a batch of twenty shouldn't
          // interrupt uploading the rest.
        });
      return uploadResult;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["intake-documents", facilityId] });
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Upload failed"),
  });
}

export function useDeleteIntakeDocument(facilityId?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string }) => intakeFn.deleteIntakeDocument({ data: input }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["intake-documents", facilityId] });
      toast.success("Document removed");
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Could not remove document"),
  });
}

export function useIntakeSuggestions(
  facilityId?: string | null,
  targetSystem?: IntakeTargetSystem,
) {
  return useQuery({
    queryKey: ["intake-suggestions", facilityId, targetSystem],
    enabled: Boolean(facilityId),
    queryFn: () =>
      intakeFn.listIntakeSuggestions({
        data: { facilityId: facilityId as string, targetSystem },
      }) as Promise<IntakeSuggestionRow[]>,
  });
}

export function useUpdateIntakeSuggestionStatus(facilityId?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      id: string;
      status: "accepted" | "edited" | "rejected";
      editedValue?: string;
    }) => intakeFn.updateIntakeSuggestionStatus({ data: input }),
    onSuccess: () => {
      void qc.invalidateQueries({
        queryKey: ["intake-suggestions", facilityId],
      });
    },
    onError: (e) =>
      toast.error(
        e instanceof Error ? e.message : "Could not update suggestion",
      ),
  });
}

/**
 * Runs the full per-document-summary -> per-system-mapping pipeline for
 * every parsed document at a facility, for one chosen target system.
 * Deliberately sequential (not Promise.all) so a slow or failing document
 * doesn't take the rest down with it, and so this stays gentle on the AI
 * gateway during a live demo rather than firing a burst of concurrent calls.
 */
export function useGenerateIntakeSuggestions(
  organizationId?: string | null,
  facilityId?: string | null,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      targetSystem,
      documents,
    }: {
      targetSystem: IntakeTargetSystem;
      documents: IntakeDocumentRow[];
    }) => {
      if (!organizationId || !facilityId)
        throw new Error("Select an organization and facility first.");
      const parsed = documents.filter((d) => d.status === "parsed");
      if (parsed.length === 0) {
        throw new Error(
          "No parsed documents to generate suggestions from yet.",
        );
      }

      const sources: {
        documentId: string;
        category: IntakeCategory;
        summary: string;
      }[] = [];
      for (const doc of parsed) {
        const result = await summarizeIntakeDocument({
          data: { documentId: doc.id },
        });
        sources.push({
          documentId: doc.id,
          category: doc.category,
          summary: result.summary,
        });
      }

      const payload = { organizationId, facilityId, sources };
      switch (targetSystem) {
        case "template_assessment":
          return mapIntakeToTemplateAssessment({ data: payload });
        case "cap_assessment":
          return mapIntakeToCapabilityAssessment({ data: payload });
        case "field_assessment":
          return mapIntakeToFieldAssessment({ data: payload });
      }
    },
    onSuccess: (result) => {
      void qc.invalidateQueries({
        queryKey: ["intake-suggestions", facilityId],
      });
      const rejectedCount = result?.rejected.length ?? 0;
      toast.success(
        rejectedCount > 0
          ? `${result?.inserted ?? 0} suggestions generated (${rejectedCount} filtered out)`
          : `${result?.inserted ?? 0} suggestions generated`,
      );
    },
    onError: (e) =>
      toast.error(
        e instanceof Error ? e.message : "Could not generate suggestions",
      ),
  });
}
