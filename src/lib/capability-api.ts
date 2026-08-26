/**
 * Capability assessment data layer. All reads and writes go through server
 * functions (src/lib/capability-api.functions.ts), which enforce RLS as the
 * signed-in user — no cross-tenant access is possible.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import * as fn from "@/lib/capability-api.functions";
import type {
  CapActionRow,
  CapAssessmentRow,
  CapCriterionRow,
  CapDomainRow,
  CapEvidenceRow,
  CapFindingLinkRow,
  CapFindingRow,
  CapImpactRow,
  CapProblemRow,
  CapResultRow,
  CapRootGapRow,
  CapScoreRow,
  CapValidationRow,
} from "./capability-domain";

/* ---------- Reference library ---------- */

export function useCapabilityLibrary() {
  return useQuery({
    queryKey: ["cap-library"],
    staleTime: 10 * 60 * 1000,
    queryFn: () =>
      fn.fetchCapabilityLibrary() as Promise<{
        domains: CapDomainRow[];
        criteria: CapCriterionRow[];
      }>,
  });
}

/* ---------- Assessments ---------- */

export function useCapAssessments(organizationId?: string) {
  return useQuery({
    queryKey: ["cap-assessments", organizationId ?? "all"],
    queryFn: () =>
      fn.fetchCapAssessments({ data: { id: organizationId } }) as Promise<
        CapAssessmentRow[]
      >,
  });
}

export function useCapAssessment(id: string) {
  return useQuery({
    queryKey: ["cap-assessment", id],
    queryFn: () =>
      fn.fetchCapAssessment({
        data: { id },
      }) as Promise<CapAssessmentRow | null>,
  });
}

/** Everything attached to one assessment, in a single hook. */
export function useCapWorkspace(assessmentId: string) {
  return useQuery({
    queryKey: ["cap-workspace", assessmentId],
    queryFn: () =>
      fn.fetchCapWorkspace({ data: { id: assessmentId } }) as Promise<{
        problem: CapProblemRow | null;
        impacts: CapImpactRow[];
        scores: CapScoreRow[];
        findings: CapFindingRow[];
        links: CapFindingLinkRow[];
        gaps: CapRootGapRow[];
        actions: CapActionRow[];
        evidence: CapEvidenceRow[];
        results: CapResultRow[];
        validations: CapValidationRow[];
      }>,
  });
}

export type CapWorkspace = NonNullable<
  ReturnType<typeof useCapWorkspace>["data"]
>;

/* ---------- Generic write helpers ---------- */

function useWorkspaceInvalidator(assessmentId: string) {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ["cap-workspace", assessmentId] });
    void qc.invalidateQueries({ queryKey: ["cap-assessment", assessmentId] });
    void qc.invalidateQueries({ queryKey: ["cap-assessments"] });
  };
}

export function useCapUpsert<T extends Record<string, unknown>>(
  assessmentId: string,
  tableName: string,
  options?: { successMessage?: string; onConflict?: string },
) {
  const invalidate = useWorkspaceInvalidator(assessmentId);
  return useMutation({
    mutationFn: async (input: T & { id?: string }) => {
      const { id, ...values } = input;
      return fn.capUpsert({ data: { table: tableName, id, values } });
    },
    onSuccess: () => {
      invalidate();
      if (options?.successMessage !== "")
        toast.success(options?.successMessage ?? "Saved");
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Could not save"),
  });
}

export function useCapDelete(
  assessmentId: string,
  tableName: string,
  label = "Deleted",
) {
  const invalidate = useWorkspaceInvalidator(assessmentId);
  return useMutation({
    mutationFn: async (id: string) =>
      fn.capDelete({ data: { table: tableName, id } }),
    onSuccess: () => {
      invalidate();
      toast.success(label);
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Could not delete"),
  });
}

/* ---------- Specific writes ---------- */

export function useCreateCapAssessment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      organization_id: string;
      facility_id?: string | null;
      name: string;
      lead_assessor?: string | null;
      scope?: string | null;
    }) => {
      if (!input.organization_id)
        throw new Error("Select an organization first.");
      if (!input.name.trim()) throw new Error("Assessment name is required.");
      return fn.createCapAssessment({ data: input });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["cap-assessments"] });
      toast.success("Capability assessment created");
    },
    onError: (e) =>
      toast.error(
        e instanceof Error ? e.message : "Could not create assessment",
      ),
  });
}

export function useSaveCapScore(assessmentId: string) {
  const invalidate = useWorkspaceInvalidator(assessmentId);
  return useMutation({
    mutationFn: async (
      input: Partial<CapScoreRow> & { criterion_id: string; dimension: string },
    ) =>
      fn.saveCapScore({
        data: {
          assessmentId,
          criterion_id: input.criterion_id,
          dimension: input.dimension,
          score: input.score ?? null,
          not_applicable: input.not_applicable ?? false,
          rationale: input.rationale ?? null,
          confidence: input.confidence ?? null,
        },
      }),
    onSuccess: invalidate,
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Could not save rating"),
  });
}

export function useSetAssessmentScore(assessmentId: string) {
  return useMutation({
    mutationFn: async ({
      overall,
      status,
    }: {
      overall: number | null;
      status?: string;
    }) => fn.setAssessmentScore({ data: { assessmentId, overall, status } }),
  });
}

export function useApproveFinding(assessmentId: string) {
  const invalidate = useWorkspaceInvalidator(assessmentId);
  return useMutation({
    mutationFn: async ({ id, approved }: { id: string; approved: boolean }) =>
      fn.approveFinding({ data: { id, approved } }),
    onSuccess: () => {
      invalidate();
      toast.success("Finding updated");
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Could not update finding"),
  });
}
