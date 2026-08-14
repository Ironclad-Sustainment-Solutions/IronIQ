/**
 * Data layer for the investigation stages of the capability assessment.
 * All access goes through server functions
 * (src/lib/capability-investigation-api.functions.ts), which enforce RLS.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import * as fn from "@/lib/capability-investigation-api.functions";
import type {
  CapChainNodeRow,
  CapDomainScreenRow,
  CapHealthSweepRow,
  CapMetricRow,
  CapObservationRow,
  CapPrimaryConstraintRow,
  ScreenStatus,
  SweepClassification,
} from "./capability-investigation";

export function useCapInvestigation(assessmentId: string) {
  return useQuery({
    queryKey: ["cap-investigation", assessmentId],
    queryFn: () =>
      fn.fetchCapInvestigation({ data: { assessmentId } }) as Promise<{
        metrics: CapMetricRow[];
        observations: CapObservationRow[];
        screens: CapDomainScreenRow[];
        chain: CapChainNodeRow[];
        sweep: CapHealthSweepRow[];
        constraint: CapPrimaryConstraintRow | null;
      }>,
  });
}

export type CapInvestigation = NonNullable<ReturnType<typeof useCapInvestigation>["data"]>;

function useInvalidator(assessmentId: string) {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ["cap-investigation", assessmentId] });
  };
}

/** Insert/update any investigation row, stamping the acting user. */
export function useInvestigationUpsert<T extends Record<string, unknown>>(
  assessmentId: string,
  tableName: string,
  opts?: { silent?: boolean; message?: string },
) {
  const invalidate = useInvalidator(assessmentId);
  return useMutation({
    mutationFn: async (input: T & { id?: string }) => {
      const { id, ...values } = input;
      return fn.investigationUpsert({ data: { table: tableName, assessmentId, id, values } });
    },
    onSuccess: () => {
      invalidate();
      if (!opts?.silent) toast.success(opts?.message ?? "Saved");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save"),
  });
}

export function useInvestigationDelete(assessmentId: string, tableName: string, label = "Removed") {
  const invalidate = useInvalidator(assessmentId);
  return useMutation({
    mutationFn: async (id: string) => fn.investigationDelete({ data: { table: tableName, id } }),
    onSuccess: () => {
      invalidate();
      toast.success(label);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not remove"),
  });
}

export function useSetDomainScreen(assessmentId: string) {
  const invalidate = useInvalidator(assessmentId);
  return useMutation({
    mutationFn: async (input: {
      domain_id: string;
      status?: ScreenStatus;
      screen_items?: string[];
      notes?: string | null;
    }) => fn.setDomainScreen({ data: { assessmentId, ...input } }),
    onSuccess: invalidate,
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save screen"),
  });
}

export function useSetHealthSweep(assessmentId: string) {
  const invalidate = useInvalidator(assessmentId);
  return useMutation({
    mutationFn: async (input: { domain_id: string; classification?: SweepClassification; note?: string | null }) =>
      fn.setHealthSweep({ data: { assessmentId, ...input } }),
    onSuccess: invalidate,
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save sweep"),
  });
}

/** The primary constraint is one row per assessment and is always assessor-declared. */
export function useSavePrimaryConstraint(assessmentId: string) {
  const invalidate = useInvalidator(assessmentId);
  return useMutation({
    mutationFn: async (input: Partial<CapPrimaryConstraintRow>) => {
      const { id: _ignored, ...values } = input;
      return fn.savePrimaryConstraint({ data: { assessmentId, values } });
    },
    onSuccess: () => {
      invalidate();
      toast.success("Primary constraint saved");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save constraint"),
  });
}

export function useSaveChainNode(assessmentId: string) {
  const invalidate = useInvalidator(assessmentId);
  return useMutation({
    mutationFn: async (input: { id?: string; step_key: string; content: string; sort_order: number }) =>
      fn.saveChainNode({ data: { assessmentId, ...input } }),
    onSuccess: invalidate,
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save chain"),
  });
}
