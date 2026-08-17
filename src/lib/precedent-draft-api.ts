import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { draftFromPrecedent } from "@/lib/precedent-draft.functions";

export interface PrecedentDraftPattern {
  id: string;
  product: "assessment" | "cad" | "cnc";
  category_label: string | null;
  pattern_summary: string;
  pattern_resolution: string | null;
  distance: number;
}

export interface PrecedentDraftResult {
  draft: string | null;
  patterns: PrecedentDraftPattern[];
}

export function useDraftFromPrecedent() {
  return useMutation({
    mutationFn: (input: { problemDescription: string; fieldLabel: string }) =>
      draftFromPrecedent({ data: input }) as Promise<PrecedentDraftResult>,
    onError: (e) =>
      toast.error(
        e instanceof Error ? e.message : "Could not check for precedent",
      ),
  });
}
