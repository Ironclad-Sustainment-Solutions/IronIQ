/**
 * Field Capability Assessment capture layer — observations, quick captures,
 * photo/document evidence and capability gaps.
 *
 * Every call goes through a server function (src/lib/field-capture-api.functions.ts)
 * which enforces the same row-level security that used to run via Supabase's
 * browser client + RLS. One client's evidence is never reachable from another
 * client's workspace.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import * as fn from "@/lib/field-capture-api.functions";
import type {
  FieldAttachmentRow,
  FieldCapabilityGap,
  FieldCaptureObservationRow,
  FieldQuickCaptureRow,
} from "./field-domains";

export const EVIDENCE_BUCKET = fn.EVIDENCE_BUCKET;

export function useFieldCapture(fieldId?: string) {
  return useQuery({
    queryKey: ["field-capture", fieldId],
    enabled: Boolean(fieldId),
    queryFn: async () => {
      const result = await fn.getFieldCapture({
        data: { fieldId: fieldId as string },
      });
      return {
        observations: result.observations as FieldCaptureObservationRow[],
        quickCaptures: result.quickCaptures as FieldQuickCaptureRow[],
        attachments: result.attachments as FieldAttachmentRow[],
        gaps: result.gaps as FieldCapabilityGap[],
      };
    },
  });
}

function useInvalidateCapture(fieldId: string) {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ["field-capture", fieldId] });
    void qc.invalidateQueries({ queryKey: ["field-review", fieldId] });
  };
}

export type ObservationInput = Partial<
  Pick<
    FieldCaptureObservationRow,
    | "domain_code"
    | "category"
    | "area"
    | "machine"
    | "production_cell"
    | "process"
    | "observed_condition"
    | "objective_evidence"
    | "assessor_notes"
    | "context_source"
    | "rating"
    | "not_observed"
    | "evidence_class"
  >
>;

export function useObservationMutations(fieldId: string) {
  const invalidate = useInvalidateCapture(fieldId);

  const add = useMutation({
    mutationFn: async (values: ObservationInput & { domain_code: string }) =>
      fn.addObservation({ data: { fieldId, values } }),
    onSuccess: () => {
      invalidate();
      toast.success("Observation saved");
    },
    onError: (e) =>
      toast.error(
        e instanceof Error ? e.message : "Could not save observation",
      ),
  });

  const update = useMutation({
    mutationFn: async ({
      id,
      values,
    }: {
      id: string;
      values: ObservationInput;
    }) => fn.updateObservation({ data: { id, values } }),
    onSuccess: invalidate,
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Could not save"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => fn.removeObservation({ data: { id } }),
    onSuccess: invalidate,
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Could not delete"),
  });

  return { add, update, remove };
}

export function useQuickCaptures(fieldId: string) {
  const invalidate = useInvalidateCapture(fieldId);

  const add = useMutation({
    mutationFn: async (values: Partial<FieldQuickCaptureRow>) =>
      fn.addQuickCapture({ data: { fieldId, values } }),
    onSuccess: () => {
      invalidate();
      toast.success("Quick capture saved");
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Could not save capture"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => fn.removeQuickCapture({ data: { id } }),
    onSuccess: invalidate,
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Could not delete"),
  });

  /** Promote a running note into a full observation record. */
  const convert = useMutation({
    mutationFn: async (capture: FieldQuickCaptureRow) =>
      fn.convertQuickCapture({
        data: {
          fieldId,
          captureId: capture.id,
          domainCode: capture.domain_code ?? "production_operations",
          area: capture.area,
          machine: capture.machine,
          observedCondition: capture.potential_problem ?? capture.note,
          note: capture.note,
        },
      }),
    onSuccess: () => {
      invalidate();
      toast.success("Converted to observation");
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Could not convert"),
  });

  return { add, remove, convert };
}

export function useGapMutations(fieldId: string) {
  const invalidate = useInvalidateCapture(fieldId);

  const add = useMutation({
    mutationFn: async (values: Partial<FieldCapabilityGap>) =>
      fn.addGap({ data: { fieldId, values } }),
    onSuccess: () => {
      invalidate();
      toast.success("Capability gap created");
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Could not create gap"),
  });

  const update = useMutation({
    mutationFn: async ({
      id,
      values,
    }: {
      id: string;
      values: Partial<FieldCapabilityGap>;
    }) => fn.updateGap({ data: { id, values } }),
    onSuccess: invalidate,
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Could not save"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => fn.removeGap({ data: { id } }),
    onSuccess: invalidate,
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Could not delete"),
  });

  /** Build a capability gap from an observation, carrying its evidence forward. */
  const fromObservation = useMutation({
    mutationFn: async ({
      observation,
      gapNumber,
    }: {
      observation: FieldCaptureObservationRow;
      gapNumber: number;
    }) => fn.gapFromObservation({ data: { fieldId, gapNumber, observation } }),
    onSuccess: () => {
      invalidate();
      toast.success("Capability gap created from observation");
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Could not create gap"),
  });

  return { add, update, remove, fromObservation };
}

/* ------------------------------ evidence files ---------------------------- */

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      resolve((reader.result as string).split(",")[1] ?? "");
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

export function useUploadEvidence(fieldId: string) {
  const invalidate = useInvalidateCapture(fieldId);
  return useMutation({
    mutationFn: async ({
      file,
      observationId,
      gapId,
      caption,
      area,
      machine,
      domainCode,
    }: {
      file: File;
      observationId?: string | null;
      gapId?: string | null;
      caption?: string | null;
      area?: string | null;
      machine?: string | null;
      domainCode?: string | null;
    }) => {
      const fileBase64 = await fileToBase64(file);
      return fn.uploadEvidence({
        data: {
          fieldId,
          fileName: file.name,
          fileBase64,
          contentType: file.type || undefined,
          observationId: observationId ?? null,
          gapId: gapId ?? null,
          caption: caption ?? null,
          area: area ?? null,
          machine: machine ?? null,
          domainCode: domainCode ?? null,
        },
      });
    },
    onSuccess: () => {
      invalidate();
      toast.success("Evidence attached");
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Could not upload evidence"),
  });
}

export function useEvidenceUrl(path?: string | null) {
  return useQuery({
    queryKey: ["field-evidence-url", path],
    enabled: Boolean(path),
    staleTime: 45 * 60 * 1000,
    queryFn: () => fn.getEvidenceUrl({ data: { path: path as string } }),
  });
}

export function useDeleteEvidence(fieldId: string) {
  const invalidate = useInvalidateCapture(fieldId);
  return useMutation({
    mutationFn: async (row: FieldAttachmentRow) =>
      fn.deleteEvidence({ data: { id: row.id } }),
    onSuccess: invalidate,
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Could not remove evidence"),
  });
}

/* ------------------- convert to a full capability assessment -------------- */

export function useConvertToFullAssessment(fieldId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      assessment,
      gaps,
    }: {
      assessment: {
        id: string;
        organization_id: string;
        facility_id: string | null;
        client_name: string | null;
        area: string | null;
        assessors: string | null;
        problem_statement: string | null;
        problem_area: string | null;
        problem_department?: string | null;
        problem_machine?: string | null;
        problem_cell?: string | null;
        problem_process?: string | null;
        problem_timing: string | null;
        attempted: string | null;
        improvement_if_resolved: string | null;
        impact_tags: string[] | null;
      };
      gaps: FieldCapabilityGap[];
    }) => fn.convertToFullAssessment({ data: { fieldId, assessment, gaps } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["cap-assessments"] });
      void qc.invalidateQueries({ queryKey: ["field-assessment", fieldId] });
      toast.success("Full capability assessment created");
    },
    onError: (e) =>
      toast.error(
        e instanceof Error ? e.message : "Could not convert assessment",
      ),
  });
}
