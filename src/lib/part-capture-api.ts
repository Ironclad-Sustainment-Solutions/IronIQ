import { useQuery } from "@tanstack/react-query";
import * as fn from "@/lib/part-capture.functions";
import type { PartCaptureSummary } from "@/lib/part-capture";

export function usePartCapture(
  organizationId?: string | null,
  facilityId?: string | null,
  partId?: string | null,
) {
  return useQuery({
    queryKey: ["part-capture", organizationId, facilityId, partId],
    enabled: Boolean(organizationId && facilityId && partId),
    queryFn: () =>
      fn.getPartCapture({
        data: {
          organizationId: organizationId as string,
          facilityId: facilityId as string,
          partId: partId as string,
        },
      }) as Promise<PartCaptureSummary>,
  });
}
