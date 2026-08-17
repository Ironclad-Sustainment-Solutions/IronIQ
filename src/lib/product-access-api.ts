import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  listProductRestrictions,
  setProductRestriction,
} from "@/lib/product-access.functions";

export type RestrictableProduct = "assessment" | "cad" | "cnc";

export function useProductRestrictions(organizationId?: string | null) {
  return useQuery({
    queryKey: ["product-restrictions", organizationId],
    enabled: Boolean(organizationId),
    queryFn: () =>
      listProductRestrictions({
        data: { organizationId: organizationId as string },
      }) as Promise<RestrictableProduct[]>,
  });
}

export function useSetProductRestriction(organizationId?: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      product: RestrictableProduct;
      restricted: boolean;
    }) => {
      if (!organizationId) throw new Error("No organization selected.");
      return setProductRestriction({ data: { organizationId, ...input } });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["product-restrictions", organizationId],
      });
      toast.success("Product access updated");
    },
    onError: (e) =>
      toast.error(
        e instanceof Error ? e.message : "Could not update product access",
      ),
  });
}
