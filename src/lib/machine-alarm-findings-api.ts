import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import * as fn from "@/lib/machine-alarm-findings.functions";
import type { UnreviewedAlarm } from "@/lib/machine-alarm-findings.functions";

export type { UnreviewedAlarm } from "@/lib/machine-alarm-findings.functions";

export function useUnreviewedAlarms(facilityId?: string | null) {
  return useQuery({
    queryKey: ["unreviewed-alarms", facilityId],
    enabled: Boolean(facilityId),
    queryFn: () =>
      fn.listUnreviewedAlarms({
        data: { facilityId: facilityId as string },
      }) as Promise<UnreviewedAlarm[]>,
  });
}

export function useCreateFindingFromAlarm(facilityId?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (eventId: string) =>
      fn.createFindingFromAlarm({ data: { eventId } }),
    onSuccess: () => {
      void qc.invalidateQueries({
        queryKey: ["unreviewed-alarms", facilityId],
      });
      void qc.invalidateQueries({ queryKey: ["findings"] });
      toast.success("Finding created from this alarm.");
    },
    onError: (e) =>
      toast.error(
        e instanceof Error ? e.message : "Could not create the finding",
      ),
  });
}
