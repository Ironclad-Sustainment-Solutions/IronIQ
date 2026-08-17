import { useQuery } from "@tanstack/react-query";
import { getEstimatingRollup } from "@/lib/executive-rollup.functions";

export interface EstimatingRollup {
  rfqFunnel: { status: string; count: number }[];
  winRate: number | null;
  wonCount: number;
  resolvedCount: number;
  avgMargin: number | null;
  estimateCount: number;
  avgQuoteToResponseDays: number | null;
}

export function useEstimatingRollup(organizationId?: string | null) {
  return useQuery({
    queryKey: ["estimating-rollup", organizationId],
    enabled: Boolean(organizationId),
    queryFn: () =>
      getEstimatingRollup({
        data: { organizationId: organizationId as string },
      }) as Promise<EstimatingRollup>,
  });
}
