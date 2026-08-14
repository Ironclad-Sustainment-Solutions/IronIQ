import { useQuery } from "@tanstack/react-query";
import * as fn from "@/lib/rfq-api.functions";
import type {
  GeometryAnalysisRun,
  Machine,
  Material,
  Rfq,
  RfqFile,
  RfqPart,
  RfqRequirement,
} from "./rfq-domain";

export interface EstimatingPart {
  part: RfqPart;
  rfq: Rfq;
  requirement: RfqRequirement | null;
  files: RfqFile[];
}

/** All RFQ parts visible to the caller, with their RFQ, requirements and files. */
export function useEstimatingParts(organizationId?: string) {
  return useQuery({
    queryKey: ["estimating-parts", organizationId ?? "all"],
    queryFn: () =>
      fn.fetchEstimatingParts({ data: { id: organizationId } }) as Promise<EstimatingPart[]>,
  });
}

/** Geometry analysis runs for a single part, newest first. */
export function useGeometryRuns(rfqPartId?: string) {
  return useQuery({
    enabled: Boolean(rfqPartId),
    queryKey: ["geometry-runs", rfqPartId],
    queryFn: () =>
      fn.fetchGeometryRuns({ data: { rfqPartId: rfqPartId as string } }) as Promise<
        GeometryAnalysisRun[]
      >,
  });
}

export function useMachines(facilityId?: string) {
  return useQuery({
    queryKey: ["machines", facilityId ?? "all"],
    queryFn: () => fn.fetchMachines({ data: { id: facilityId } }) as Promise<Machine[]>,
  });
}

export function useMaterials() {
  return useQuery({
    queryKey: ["materials"],
    queryFn: () => fn.fetchMaterials() as Promise<Material[]>,
  });
}
