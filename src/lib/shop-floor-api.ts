import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import * as fn from "@/lib/shop-floor.functions";
import type {
  ConnectionStatus,
  MachineControl,
  MachineProtocol,
  MachineRunEvent,
  PartOutcomeCard,
  ShopMachine,
  ShopPart,
} from "@/lib/shop-floor";

export function useShopMachines(
  organizationId?: string | null,
  facilityId?: string | null,
) {
  return useQuery({
    queryKey: ["shop-machines", organizationId, facilityId],
    enabled: Boolean(organizationId && facilityId),
    queryFn: () =>
      fn.listShopMachines({
        data: {
          organizationId: organizationId as string,
          facilityId: facilityId as string,
        },
      }) as Promise<ShopMachine[]>,
  });
}

export function useShopMachine(machineId?: string | null) {
  return useQuery({
    queryKey: ["shop-machine", machineId],
    enabled: Boolean(machineId),
    queryFn: () =>
      fn.getShopMachine({
        data: { id: machineId as string },
      }) as Promise<ShopMachine | null>,
  });
}

export function useMachineRuns(machineId?: string | null) {
  return useQuery({
    queryKey: ["shop-machine-runs", machineId],
    enabled: Boolean(machineId),
    queryFn: () =>
      fn.listMachineRuns({
        data: { machineId: machineId as string },
      }) as Promise<MachineRunEvent[]>,
  });
}

export interface MachineLiveState {
  last_polled_at: string | null;
  last_sequence: number | null;
  last_execution: string | null;
  last_part_count: number | null;
  last_part_number: string | null;
  last_error: string | null;
}

export function useMachineLiveState(machineId?: string | null) {
  return useQuery({
    queryKey: ["shop-machine-live-state", machineId],
    enabled: Boolean(machineId),
    queryFn: () =>
      fn.getMachineLiveState({
        data: { machineId: machineId as string },
      }) as Promise<MachineLiveState | null>,
  });
}

export function useGenerateMachineBridgeApiKey(machineId?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      fn.generateMachineBridgeApiKey({
        data: { machineId: machineId as string },
      }) as Promise<{ apiKey: string }>,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["shop-machine", machineId] });
      toast.success(
        "New bridge API key generated — copy it now, it won't be shown again.",
      );
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Could not generate a key"),
  });
}

function invalidateMachines(
  qc: ReturnType<typeof useQueryClient>,
  organizationId?: string | null,
  facilityId?: string | null,
  machineId?: string,
) {
  void qc.invalidateQueries({
    queryKey: ["shop-machines", organizationId, facilityId],
  });
  void qc.invalidateQueries({ queryKey: ["shop-machines"] });
  if (machineId) {
    void qc.invalidateQueries({ queryKey: ["shop-machine", machineId] });
    void qc.invalidateQueries({ queryKey: ["shop-machine-runs", machineId] });
  }
}

export function useCreateShopMachine(
  organizationId?: string | null,
  facilityId?: string | null,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      assetId: string;
      name: string;
      make: string;
      model: string;
      control: MachineControl;
      protocol: MachineProtocol;
      location?: string;
      mtconnectAgentUrl?: string;
      mtconnectDeviceName?: string;
      currentPartNumber?: string;
    }) => {
      if (!organizationId || !facilityId) {
        throw new Error("Select an organization and facility first.");
      }
      return fn.createShopMachine({
        data: { organizationId, facilityId, ...input },
      });
    },
    onSuccess: () => {
      invalidateMachines(qc, organizationId, facilityId);
      toast.success("Machine added");
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Could not add machine"),
  });
}

export function useUpdateShopMachine(
  organizationId?: string | null,
  facilityId?: string | null,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      id: string;
      assetId: string;
      name: string;
      make: string;
      model: string;
      control: MachineControl;
      protocol: MachineProtocol;
      location?: string;
      mtconnectAgentUrl?: string;
      mtconnectDeviceName?: string;
      currentPartNumber?: string;
      connectionStatus?: ConnectionStatus;
    }) => fn.updateShopMachine({ data: input }),
    onSuccess: (_data, input) => {
      invalidateMachines(qc, organizationId, facilityId, input.id);
      toast.success("Machine updated");
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Could not update machine"),
  });
}

export function useDeleteShopMachine(
  organizationId?: string | null,
  facilityId?: string | null,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => fn.deleteShopMachine({ data: { id } }),
    onSuccess: () => {
      invalidateMachines(qc, organizationId, facilityId);
      toast.success("Machine removed");
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Could not remove machine"),
  });
}

export function useCreateMachineRun(machineId?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      occurredAt: string;
      partNumber: string;
      cycles: number;
      runtimeMinutes: number;
      idleMinutes: number;
      downtimeMinutes: number;
    }) => {
      if (!machineId) throw new Error("Select a machine first.");
      return fn.createMachineRun({
        data: { machineId, source: "manual", ...input },
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["shop-machine-runs", machineId] });
      void qc.invalidateQueries({ queryKey: ["shop-machine", machineId] });
      toast.success("Run logged");
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Could not log run"),
  });
}

export function useImportMachineRunsCsv(machineId?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (csvText: string) => {
      if (!machineId) throw new Error("Select a machine first.");
      return fn.importMachineRunsCsv({ data: { machineId, csvText } });
    },
    onSuccess: (result) => {
      void qc.invalidateQueries({ queryKey: ["shop-machine-runs", machineId] });
      void qc.invalidateQueries({ queryKey: ["shop-machine", machineId] });
      toast.success(
        `Imported ${result.imported} run${result.imported === 1 ? "" : "s"}`,
      );
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Could not import CSV"),
  });
}

export function useShopParts(
  organizationId?: string | null,
  facilityId?: string | null,
) {
  return useQuery({
    queryKey: ["shop-parts", organizationId, facilityId],
    enabled: Boolean(organizationId),
    queryFn: () =>
      fn.listShopParts({
        data: {
          organizationId: organizationId as string,
          facilityId: facilityId ?? undefined,
        },
      }) as Promise<ShopPart[]>,
  });
}

export function usePartOutcomeCards(
  organizationId?: string | null,
  facilityId?: string | null,
) {
  return useQuery({
    queryKey: ["part-outcome-cards", organizationId, facilityId],
    enabled: Boolean(organizationId),
    queryFn: () =>
      fn.listPartOutcomeCards({
        data: {
          organizationId: organizationId as string,
          facilityId: facilityId ?? undefined,
        },
      }) as Promise<PartOutcomeCard[]>,
  });
}

export function useSavePartOutcomeCard(
  organizationId?: string | null,
  facilityId?: string | null,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      id?: string;
      partNumber: string;
      partDescription?: string;
      drawingRef?: string;
      machineId?: string | null;
      cncChangeLogId?: string;
      capabilityActionId?: string;
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
    }) => {
      if (!organizationId) throw new Error("Select an organization first.");
      return fn.savePartOutcomeCard({
        data: {
          organizationId,
          facilityId: facilityId ?? undefined,
          ...input,
        },
      }) as Promise<PartOutcomeCard>;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["part-outcome-cards"] });
      void qc.invalidateQueries({ queryKey: ["shop-parts"] });
      void qc.invalidateQueries({ queryKey: ["cnc-change-log"] });
      toast.success("Before/after card saved");
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Could not save part card"),
  });
}
