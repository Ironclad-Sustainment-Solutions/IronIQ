import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  deleteOrganization,
  deleteFacility,
} from "@/lib/admin-org-delete.functions";

export function useDeleteOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteOrganization({ data: { id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
      queryClient.invalidateQueries({ queryKey: ["facilities"] });
      toast.success("Organization permanently deleted");
    },
    onError: (e) =>
      toast.error(
        e instanceof Error ? e.message : "Could not delete organization",
      ),
  });
}

export function useDeleteFacility() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteFacility({ data: { id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["facilities"] });
      toast.success("Facility permanently deleted");
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Could not delete facility"),
  });
}
