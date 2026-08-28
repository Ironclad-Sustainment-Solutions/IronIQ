import { useQuery } from "@tanstack/react-query";
import { getSustainmentRollup } from "@/lib/sustainment.functions";
import type { SustainmentRollup } from "@/lib/sustainment.functions";

export type {
  SustainmentRollup,
  HumanSustainmentCheck,
  TelemetrySustainmentCheck,
} from "@/lib/sustainment.functions";

export function useSustainmentRollup() {
  return useQuery({
    queryKey: ["sustainment-rollup"],
    queryFn: () => getSustainmentRollup() as Promise<SustainmentRollup>,
  });
}
