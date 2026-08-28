import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import * as fn from "@/lib/edge-ingest-admin.functions";

export interface EdgeIngestKeyInfo {
  hint: string | null;
  createdAt: string | null;
}

export function useEdgeIngestKeyInfo(facilityId?: string | null) {
  return useQuery({
    queryKey: ["edge-ingest-key-info", facilityId],
    enabled: Boolean(facilityId),
    queryFn: () =>
      fn.getEdgeIngestKeyInfo({
        data: { facilityId: facilityId as string },
      }) as Promise<EdgeIngestKeyInfo | null>,
  });
}

export function useGenerateEdgeIngestKey(facilityId?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      fn.generateEdgeIngestKey({
        data: { facilityId: facilityId as string },
      }) as Promise<{ apiKey: string }>,
    onSuccess: () => {
      void qc.invalidateQueries({
        queryKey: ["edge-ingest-key-info", facilityId],
      });
      toast.success(
        "New edge ingest key generated — copy it now, it won't be shown again.",
      );
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Could not generate a key"),
  });
}
