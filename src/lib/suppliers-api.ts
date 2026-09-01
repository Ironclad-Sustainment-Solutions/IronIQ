import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import * as fn from "@/lib/suppliers.functions";
import type { Supplier } from "@/lib/suppliers.functions";

export type { Supplier } from "@/lib/suppliers.functions";

export function useSuppliers(organizationId?: string | null) {
  return useQuery({
    queryKey: ["suppliers", organizationId],
    enabled: Boolean(organizationId),
    queryFn: () =>
      fn.listSuppliers({
        data: { organizationId: organizationId as string },
      }) as Promise<Supplier[]>,
  });
}

interface SupplierFormInput {
  organizationId: string;
  facilityId?: string;
  name: string;
  category?: string;
  primaryContactName?: string;
  primaryContactEmail?: string;
  primaryContactPhone?: string;
  leadTimeDays?: number;
  qualityNotes?: string;
}

export function useCreateSupplier(organizationId?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SupplierFormInput) =>
      fn.createSupplier({ data: input }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["suppliers", organizationId] });
      toast.success("Supplier added.");
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Could not add supplier"),
  });
}

export function useUpdateSupplier(organizationId?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SupplierFormInput & { id: string }) =>
      fn.updateSupplier({ data: input }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["suppliers", organizationId] });
      toast.success("Supplier updated.");
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Could not update supplier"),
  });
}

export function useArchiveSupplier(organizationId?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => fn.archiveSupplier({ data: { id } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["suppliers", organizationId] });
      toast.success("Supplier archived.");
    },
    onError: (e) =>
      toast.error(
        e instanceof Error ? e.message : "Could not archive supplier",
      ),
  });
}
