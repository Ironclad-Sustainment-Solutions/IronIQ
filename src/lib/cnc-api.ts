import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import * as fn from "@/lib/cnc.functions";

export type CncChangeCategory =
  "feed_speed" | "toolpath" | "fixture" | "tooling" | "program_logic" | "other";

export interface CncChangeLogRow {
  id: string;
  machine_id: string | null;
  machine_name: string;
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
      outcomeDescription: string;
      contributeToIntelligence?: boolean;
    }) => fn.verifyCncChangeLogEntry({ data: input }),
    onSuccess: () => {
      void qc.invalidateQueries({
        queryKey: ["cnc-change-log", organizationId],
      });
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
