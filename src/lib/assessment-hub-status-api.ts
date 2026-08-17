import { useQuery } from "@tanstack/react-query";
import { getAssessmentHubStatus } from "@/lib/assessment-hub-status.functions";

export interface AssessmentHubStatus {
  template: { inProgress: number; finalized: number; total: number };
  capability: { inProgress: number; finalized: number; total: number };
  field: { total: number };
}

export function useAssessmentHubStatus(facilityId?: string | null) {
  return useQuery({
    queryKey: ["assessment-hub-status", facilityId],
    enabled: Boolean(facilityId),
    queryFn: () =>
      getAssessmentHubStatus({
        data: { facilityId: facilityId as string },
      }) as Promise<AssessmentHubStatus>,
  });
}
