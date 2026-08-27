import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import * as fn from "@/lib/cnc.functions";

export type CncChangeCategory =
  "feed_speed" | "toolpath" | "fixture" | "tooling" | "program_logic" | "other";

export interface CncChangeLogRow {
  id: string;
  machine_id: string | null;
  machine_name: string;
  part_number: string | null;
  program_identifier: string | null;
  change_category: CncChangeCategory;
  change_description: string;
  reason: string;
  outcome_description: string | null;
  status: "logged" | "verified";
  created_at: string;
}

export function useCncChangeLog(organizationId?: string | null) {
  return useQuery({
    queryKey: ["cnc-change-log", organizationId],
    enabled: Boolean(organizationId),
    queryFn: () =>
      fn.listCncChangeLog({
        data: { organizationId: organizationId as string },
      }) as Promise<CncChangeLogRow[]>,
  });
}

export function useCreateCncLogEntry(organizationId?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      facilityId?: string | null;
      machineId: string;
      partNumber?: string;
      programIdentifier?: string;
      changeCategory: CncChangeCategory;
      changeDescription: string;
      reason: string;
    }) => {
      if (!organizationId) throw new Error("Select an organization first.");
      return fn.createCncChangeLogEntry({ data: { organizationId, ...input } });
    },
    onSuccess: () => {
      void qc.invalidateQueries({
        queryKey: ["cnc-change-log", organizationId],
      });
      toast.success("Change logged");
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Could not log change"),
  });
}

export function useVerifyCncLogEntry(organizationId?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      id: string;
      partNumber: string;
      whatChanged: string;
      cycleTimeSecBefore: number;
      cycleTimeSecAfter: number;
      setupMinBefore: number;
      setupMinAfter: number;
      hoursOnPartBefore: number;
      hoursOnPartAfter: number;
      partsPerShiftBefore?: number | null;
      partsPerShiftAfter?: number | null;
      downtimeMinBefore?: number | null;
      downtimeMinAfter?: number | null;
      beforeAt?: string;
      afterAt?: string;
      contributeToIntelligence?: boolean;
    }) => fn.verifyCncChangeLogEntry({ data: input }),
    onSuccess: () => {
      void qc.invalidateQueries({
        queryKey: ["cnc-change-log", organizationId],
      });
      void qc.invalidateQueries({ queryKey: ["part-outcome-cards"] });
      void qc.invalidateQueries({ queryKey: ["shop-parts"] });
      toast.success("Marked verified");
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Could not verify entry"),
  });
}

export function useDeleteCncLogEntry(organizationId?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => fn.deleteCncChangeLogEntry({ data: { id } }),
    onSuccess: () => {
      void qc.invalidateQueries({
        queryKey: ["cnc-change-log", organizationId],
      });
      toast.success("Entry removed");
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Could not remove entry"),
  });
}

export function useUpdateCncLogEntry(organizationId?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      id: string;
      machineId: string;
      programIdentifier?: string;
      changeCategory: CncChangeCategory;
      changeDescription: string;
      reason: string;
    }) => fn.updateCncChangeLogEntry({ data: input }),
    onSuccess: () => {
      void qc.invalidateQueries({
        queryKey: ["cnc-change-log", organizationId],
      });
      toast.success("Entry updated");
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Could not update entry"),
  });
}
