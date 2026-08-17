import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { getFacilityTrendSummary } from "@/lib/facility-trend.functions";

export interface FacilityTrendResult {
  summary: string;
  hasEnoughData: boolean;
}

export function useFacilityTrendSummary() {
  return useMutation({
    mutationFn: (facilityId: string) =>
      getFacilityTrendSummary({
        data: { facilityId },
      }) as Promise<FacilityTrendResult>,
    onError: (e) =>
      toast.error(
        e instanceof Error ? e.message : "Could not generate summary",
      ),
  });
}
