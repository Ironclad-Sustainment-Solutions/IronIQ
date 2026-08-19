/**
 * CAD Conversion (raster path) data layer. Mirrors intake-api.ts's shape.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import * as fn from "@/lib/cad.functions";

export type CadJobStatus =
  "uploaded" | "processing" | "extracted" | "reviewed" | "failed";

export interface CadJobRow {
  id: string;
  original_filename: string;
  mime_type: string | null;
  byte_size: number;
  source_type: "raster" | "vector";
  status: CadJobStatus;
  failure_reason: string | null;
  storage_path: string;
  created_at: string;
}

export interface CadFieldRow {
  id: string;
  field_type: string;
  field_name: string;
  field_value: string;
  location_hint: string | null;
  confidence: "low" | "moderate" | "high";
  status: "suggested" | "accepted" | "edited" | "rejected";
  created_at: string;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      resolve((reader.result as string).split(",")[1] ?? "");
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

export function useCadJobs(organizationId?: string | null) {
  return useQuery({
    queryKey: ["cad-jobs", organizationId],
    enabled: Boolean(organizationId),
    refetchInterval: (query) => {
      const rows = (query.state.data as CadJobRow[] | undefined) ?? [];
      const stillWorking = rows.some(
        (r) => r.status === "uploaded" || r.status === "processing",
      );
      return stillWorking ? 2000 : false;
    },
    queryFn: () =>
      fn.listCadJobs({
        data: { organizationId: organizationId as string },
      }) as Promise<CadJobRow[]>,
  });
}

export function useUploadCadJob(
  organizationId?: string | null,
  facilityId?: string | null,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      if (!organizationId) throw new Error("Select an organization first.");
      const fileBase64 = await fileToBase64(file);
      const result = await fn.createCadJob({
        data: {
          organizationId,
          facilityId: facilityId ?? undefined,
          fileName: file.name,
          fileBase64,
          contentType: file.type || undefined,
        },
      });
      await fn.extractCadJob({ data: { jobId: result.jobId } }).catch(() => {
        // Extraction failures surface via the job's own status/failure_reason.
      });
      return result;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["cad-jobs", organizationId] });
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Upload failed"),
  });
}

export function useDeleteCadJob(organizationId?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string }) => fn.deleteCadJob({ data: input }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["cad-jobs", organizationId] });
      toast.success("Job removed");
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Could not remove job"),
  });
}

export function useCadFields(jobId?: string | null) {
  return useQuery({
    queryKey: ["cad-fields", jobId],
    enabled: Boolean(jobId),
    queryFn: () =>
      fn.listCadFields({ data: { jobId: jobId as string } }) as Promise<
        CadFieldRow[]
      >,
  });
}

export function useUpdateCadFieldStatus(jobId?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      id: string;
      status: "accepted" | "edited" | "rejected";
      editedValue?: string;
      editedFieldName?: string;
      editedFieldType?: string;
      editedLocationHint?: string;
    }) => fn.updateCadFieldStatus({ data: input }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["cad-fields", jobId] });
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Could not update field"),
  });
}
