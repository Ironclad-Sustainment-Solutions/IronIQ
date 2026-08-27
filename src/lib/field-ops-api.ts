/**
 * Data hooks for the field operations layer. Every call goes through a
 * server function (src/lib/field-ops-api.functions.ts), which enforces RLS
 * as the signed-in user — one client's floor data never reaches another's.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import * as fn from "@/lib/field-ops-api.functions";
import type {
  BaselineMetricRow,
  CauseNodeRow,
  DelayRow,
  EventMarkRow,
  EvidenceItemRow,
  OpportunityRow,
  PilotMetricRow,
  PilotRow,
  ProductionEventRow,
  SmeDependencyRow,
} from "./field-ops";

export const FIELD_OPS_KEY = "field-ops";

export function useFieldOps(fieldId?: string) {
  return useQuery({
    queryKey: [FIELD_OPS_KEY, fieldId],
    enabled: Boolean(fieldId),
    queryFn: () =>
      fn.fetchFieldOps({ data: { fieldId: fieldId as string } }) as Promise<{
        events: ProductionEventRow[];
        marks: EventMarkRow[];
        delays: DelayRow[];
        causes: CauseNodeRow[];
        evidence: EvidenceItemRow[];
        smes: SmeDependencyRow[];
        metrics: BaselineMetricRow[];
        pilots: PilotRow[];
        pilotMetrics: PilotMetricRow[];
        opportunities: OpportunityRow[];
      }>,
  });
}

function useInvalidate(fieldId: string) {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: [FIELD_OPS_KEY, fieldId] });
    void qc.invalidateQueries({ queryKey: ["field-capture", fieldId] });
  };
}

/** Generic child-record mutations for a table keyed by field_assessment_id. */
function useRowMutations<T extends { id: string }>(
  fieldId: string,
  tableName: string,
  labels: { created: string; deleted?: string },
  parentColumn = "field_assessment_id",
  parentId?: string,
) {
  const invalidate = useInvalidate(fieldId);

  const add = useMutation({
    mutationFn: async (values: Partial<T>) =>
      fn.rowAdd({
        data: {
          table: tableName,
          parentColumn,
          parentId: parentId ?? fieldId,
          values,
          stampCreatedBy: parentColumn === "field_assessment_id",
        },
      }) as Promise<T>,
    onSuccess: () => {
      invalidate();
      toast.success(labels.created);
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Could not save"),
  });

  const update = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: Partial<T> }) =>
      fn.rowUpdate({ data: { table: tableName, id, values } }),
    onSuccess: invalidate,
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Could not save"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) =>
      fn.rowRemove({ data: { table: tableName, id } }),
    onSuccess: () => {
      invalidate();
      if (labels.deleted) toast.success(labels.deleted);
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Could not delete"),
  });

  return { add, update, remove };
}

export const useEventMutations = (fieldId: string) =>
  useRowMutations<ProductionEventRow>(fieldId, "field_production_events", {
    created: "Event started",
    deleted: "Event removed",
  });

export const useDelayMutations = (fieldId: string) =>
  useRowMutations<DelayRow>(fieldId, "field_delays", {
    created: "Delay captured",
    deleted: "Delay removed",
  });

export const useCauseMutations = (fieldId: string) =>
  useRowMutations<CauseNodeRow>(fieldId, "field_cause_nodes", {
    created: "Step added",
  });

export const useEvidenceItemMutations = (fieldId: string) =>
  useRowMutations<EvidenceItemRow>(fieldId, "field_evidence_items", {
    created: "Evidence logged",
    deleted: "Evidence removed",
  });

export const useSmeMutations = (fieldId: string) =>
  useRowMutations<SmeDependencyRow>(fieldId, "field_sme_dependencies", {
    created: "Expert profile added",
  });

export const useBaselineMetricMutations = (fieldId: string) =>
  useRowMutations<BaselineMetricRow>(fieldId, "field_baseline_metrics", {
    created: "Metric added",
  });

export const usePilotMutations = (fieldId: string) =>
  useRowMutations<PilotRow>(fieldId, "field_pilots", {
    created: "Pilot created",
  });

export const useOpportunityMutations = (fieldId: string) =>
  useRowMutations<OpportunityRow>(fieldId, "field_opportunities", {
    created: "Opportunity added",
  });

/** Pilot measurements keyed by pilot id, usable across every pilot on the page. */
export function usePilotMetricActions(fieldId: string) {
  const invalidate = useInvalidate(fieldId);
  const wrap = <T>(run: (v: T) => Promise<void>) => ({
    run: async (v: T) => {
      try {
        await run(v);
        invalidate();
      } catch (e) {
        toast.error(
          e instanceof Error ? e.message : "Could not save measurement",
        );
      }
    },
  });

  const add = wrap(
    async ({
      pilotId,
      values,
    }: {
      pilotId: string;
      values: Partial<PilotMetricRow>;
    }) => {
      await fn.rowAdd({
        data: {
          table: "field_pilot_metrics",
          parentColumn: "pilot_id",
          parentId: pilotId,
          values,
        },
      });
    },
  );
  const update = wrap(
    async ({ id, values }: { id: string; values: Partial<PilotMetricRow> }) => {
      await fn.rowUpdate({
        data: { table: "field_pilot_metrics", id, values },
      });
    },
  );
  const remove = wrap(async (id: string) => {
    await fn.rowRemove({ data: { table: "field_pilot_metrics", id } });
  });

  return {
    add: (pilotId: string, values: Partial<PilotMetricRow>) =>
      void add.run({ pilotId, values }),
    update: (id: string, values: Partial<PilotMetricRow>) =>
      void update.run({ id, values }),
    remove: (id: string) => void remove.run(id),
  };
}

export function usePilotMetricMutations(fieldId: string, pilotId: string) {
  return useRowMutations<PilotMetricRow>(
    fieldId,
    "field_pilot_metrics",
    { created: "Measurement added" },
    "pilot_id",
    pilotId,
  );
}

/** One-tap changeover marks. Re-tapping a mark records a correction history. */
export function useEventMarks(fieldId: string) {
  const invalidate = useInvalidate(fieldId);

  const mark = useMutation({
    mutationFn: async ({
      eventId,
      markCode,
      existing,
      at,
    }: {
      eventId: string;
      markCode: string;
      existing?: EventMarkRow;
      at?: Date;
    }) =>
      fn.markEvent({
        data: {
          eventId,
          markCode,
          existing: existing
            ? {
                id: existing.id,
                marked_at: existing.marked_at,
                original_at: existing.original_at,
                edit_history: existing.edit_history,
              }
            : undefined,
          at: at?.toISOString(),
        },
      }),
    onSuccess: invalidate,
    onError: (e) =>
      toast.error(
        e instanceof Error ? e.message : "Could not record timestamp",
      ),
  });

  const clear = useMutation({
    mutationFn: async (id: string) =>
      fn.rowRemove({ data: { table: "field_event_marks", id } }),
    onSuccess: invalidate,
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Could not clear timestamp"),
  });

  return { mark, clear };
}
