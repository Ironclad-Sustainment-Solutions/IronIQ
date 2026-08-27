/**
 * Field assessment data layer. Every read and write goes through server
 * functions (src/lib/field-assessment-api.functions.ts), which enforce RLS.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import * as fn from "@/lib/field-assessment-api.functions";
import type { FieldAssessmentRow, FieldRatingRow } from "./field-assessment";
import type {
  FieldConstraintRow,
  FieldGapRow,
  FieldObservationRow,
  FieldOpportunityRow,
} from "./field-form";

export function useFieldAssessments(
  organizationId?: string | null,
  facilityId?: string | null,
) {
  return useQuery({
    queryKey: ["field-assessments", organizationId, facilityId],
    enabled: Boolean(organizationId),
    queryFn: () =>
      fn.fetchFieldAssessments({
        data: { organizationId: organizationId as string, facilityId },
      }) as Promise<FieldAssessmentRow[]>,
  });
}

export function useFieldAssessment(id?: string) {
  return useQuery({
    queryKey: ["field-assessment", id],
    enabled: Boolean(id),
    queryFn: () =>
      fn.fetchFieldAssessment({ data: { id: id as string } }) as Promise<{
        assessment: FieldAssessmentRow | null;
        ratings: FieldRatingRow[];
      }>,
  });
}

export function useCreateFieldAssessment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      organization_id: string;
      facility_id?: string | null;
      area: string;
      work_center?: string | null;
      shift?: string | null;
      observer_name?: string | null;
    }) => {
      if (!input.organization_id)
        throw new Error("Select an organization first.");
      if (!input.area.trim())
        throw new Error("Enter the area or cell you are standing in.");
      return fn.createFieldAssessment({ data: input });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["field-assessments"] });
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Could not start walk"),
  });
}

export function useSaveFieldRating(fieldAssessmentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      domain_id: string;
      score?: number | null;
      not_applicable?: boolean;
      note?: string | null;
      needs_action?: boolean;
    }) => fn.saveFieldRating({ data: { fieldAssessmentId, ...input } }),
    onSuccess: () => {
      void qc.invalidateQueries({
        queryKey: ["field-assessment", fieldAssessmentId],
      });
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Could not save rating"),
  });
}

export function useUpdateFieldAssessment(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: Partial<FieldAssessmentRow>) =>
      fn.updateFieldAssessment({ data: { id, values } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["field-assessment", id] });
      void qc.invalidateQueries({ queryKey: ["field-assessments"] });
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Could not save"),
  });
}

export function useDeleteFieldAssessment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      fn.deleteFieldAssessment({ data: { id } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["field-assessments"] });
      toast.success("Field assessment deleted");
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Could not delete"),
  });
}

/* ---------------------------------------------------------------------------
 * Ironclad Field Capability Review — sections, gaps, constraints, matrix.
 * ------------------------------------------------------------------------ */

export function useFieldReview(fieldId?: string) {
  return useQuery({
    queryKey: ["field-review", fieldId],
    enabled: Boolean(fieldId),
    queryFn: () =>
      fn.fetchFieldReview({ data: { fieldId: fieldId as string } }) as Promise<{
        observations: FieldObservationRow[];
        gaps: FieldGapRow[];
        constraints: FieldConstraintRow[];
        opportunities: FieldOpportunityRow[];
      }>,
  });
}

export function useSaveObservation(fieldId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      section_code: string;
      area_code: string;
      rating?: number | null;
      not_observed?: boolean;
      notes?: string | null;
    }) => fn.saveObservation({ data: { fieldId, ...input } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["field-review", fieldId] });
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Could not save rating"),
  });
}

type ChildTable = "field_gaps" | "field_constraints" | "field_opportunities";

function useChildMutations(fieldId: string, name: ChildTable) {
  const qc = useQueryClient();
  const invalidate = () =>
    void qc.invalidateQueries({ queryKey: ["field-review", fieldId] });

  const add = useMutation({
    mutationFn: async (values: Record<string, unknown>) =>
      fn.childAdd({ data: { fieldId, table: name, values } }),
    onSuccess: invalidate,
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Could not add entry"),
  });

  const update = useMutation({
    mutationFn: async ({
      id,
      values,
    }: {
      id: string;
      values: Record<string, unknown>;
    }) => fn.childUpdate({ data: { table: name, id, values } }),
    onSuccess: invalidate,
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Could not save"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) =>
      fn.childRemove({ data: { table: name, id } }),
    onSuccess: invalidate,
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Could not delete"),
  });

  return { add, update, remove };
}

export const useFieldGaps = (fieldId: string) =>
  useChildMutations(fieldId, "field_gaps");
export const useFieldConstraints = (fieldId: string) =>
  useChildMutations(fieldId, "field_constraints");
export const useFieldOpportunities = (fieldId: string) =>
  useChildMutations(fieldId, "field_opportunities");
