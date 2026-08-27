/**
 * Ask IronIQ (query) + intelligence pattern review queue data layer.
 * Every call goes through a server function which enforces its own
 * authorization (platform-staff-only for the review queue) — same
 * pattern as every other data layer in this app.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { askIronIQ } from "@/lib/ask-ironiq.functions";
import {
  listPendingPatterns,
  approveIntelligencePattern,
  rejectIntelligencePattern,
} from "@/lib/intelligence-review.functions";

export type IntelligenceProductFilter = "assessment" | "cad" | "cnc";

export interface AskIronIQPattern {
  id: string;
  product: IntelligenceProductFilter;
  category_label: string | null;
  pattern_summary: string;
  pattern_resolution: string | null;
  pattern_outcome: string | null;
  origin: "engagement_derived" | "reference_library";
  distance: number;
}

export interface AskIronIQResult {
  answer: string;
  patterns: AskIronIQPattern[];
  usedExternalKnowledge: boolean;
  noMatchingPrecedent?: boolean;
}

export function useAskIronIQ() {
  return useMutation({
    mutationFn: ({
      question,
      products,
    }: {
      question: string;
      products?: IntelligenceProductFilter[];
    }) =>
      askIronIQ({ data: { question, products } }) as Promise<AskIronIQResult>,
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Could not get an answer"),
  });
}

export interface PendingPattern {
  id: string;
  product: string;
  category_label: string | null;
  pattern_summary: string;
  pattern_resolution: string | null;
  pattern_outcome: string | null;
  created_at: string;
}

export function usePendingPatterns() {
  return useQuery({
    queryKey: ["pending-patterns"],
    queryFn: () => listPendingPatterns() as Promise<PendingPattern[]>,
  });
}

export function useApprovePattern() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => approveIntelligencePattern({ data: { id } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["pending-patterns"] });
      toast.success("Pattern approved and shared");
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Could not approve pattern"),
  });
}

export function useRejectPattern() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      rejectIntelligencePattern({ data: { id, reason } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["pending-patterns"] });
      toast.success("Pattern rejected");
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Could not reject pattern"),
  });
}
