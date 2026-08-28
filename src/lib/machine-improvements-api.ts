import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import * as fn from "@/lib/machine-improvements.functions";
import type {
  ImprovementComparison,
  ShopMachineImprovement,
} from "@/lib/machine-improvements";

export function useMachineImprovements(
  organizationId?: string | null,
  facilityId?: string | null,
) {
  return useQuery({
    queryKey: ["machine-improvements", organizationId, facilityId],
    enabled: Boolean(organizationId && facilityId),
    queryFn: () =>
      fn.listMachineImprovements({
        data: {
          organizationId: organizationId as string,
          facilityId: facilityId as string,
        },
      }) as Promise<ShopMachineImprovement[]>,
  });
}

export function useMachineImprovementComparison(id?: string | null) {
  return useQuery({
    queryKey: ["machine-improvement-comparison", id],
    enabled: Boolean(id),
    queryFn: () =>
      fn.getMachineImprovementComparison({
        data: { id: id as string },
      }) as Promise<{
        improvement: ShopMachineImprovement;
        comparison: ImprovementComparison;
      }>,
  });
}

export function useCreateMachineImprovement(
  organizationId?: string | null,
  facilityId?: string | null,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      machineId: string;
      partId?: string;
      partNumber?: string;
      title: string;
      changedAt: string;
      windowBeforeHours: number;
      windowAfterHours: number;
    }) => {
      if (!organizationId || !facilityId) {
        throw new Error("Select an organization and facility first.");
      }
      return fn.createMachineImprovement({
        data: { organizationId, facilityId, ...input },
      }) as Promise<ShopMachineImprovement>;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["machine-improvements"] });
      void qc.invalidateQueries({ queryKey: ["shop-parts"] });
      toast.success("Change saved");
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Could not save change"),
  });
}
