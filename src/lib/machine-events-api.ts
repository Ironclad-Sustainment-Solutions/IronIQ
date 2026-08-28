import { useQuery } from "@tanstack/react-query";
import { listFloorView } from "@/lib/machine-events.functions";
import { localDayWindow, type FloorView } from "@/lib/machine-events";

export function useFloorView(
  organizationId?: string | null,
  facilityId?: string | null,
) {
  const dayKey = localDayWindow(new Date()).start.toISOString().slice(0, 10);
  return useQuery({
    queryKey: ["shop-floor-view", organizationId, facilityId, dayKey],
    enabled: Boolean(organizationId && facilityId),
    queryFn: () => {
      const window = localDayWindow(new Date());
      return listFloorView({
        data: {
          organizationId: organizationId as string,
          facilityId: facilityId as string,
          windowStart: window.start.toISOString(),
          windowEnd: window.end.toISOString(),
        },
      }) as Promise<FloorView>;
    },
  });
}
