/**
 * Sustainment rollup: combines cap_validations (human-reported, from the
 * Capability Assessment's RestorationPanel check-ins) with real IronIQ
 * Edge telemetry (a fresh comparison of each shop_machine_improvements
 * record's original after-window against current performance). Neither
 * source alone tells the whole story -- a human check-in only happens
 * when someone remembers to do it; telemetry alone doesn't capture
 * things like "is this documented" or "can someone else execute it."
 * Together they give an actual, evidence-based answer to "are our fixes
 * still holding," not a placeholder page.
 */

import { createServerFn } from "@tanstack/react-start";
import { requireAuth } from "@/lib/auth/auth-middleware";
import { withUser } from "@/lib/db.server";
import { resolveMachineEventTable } from "@/lib/machine-events.server";
import {
  computeImprovementBeforeAfter,
  eventQueryFromImprovement,
  summarizeCaptureEvents,
  type MachineCaptureEvent,
  type ShopMachineImprovement,
} from "@/lib/machine-improvements";
import { assessDrift, type DriftAssessment } from "@/lib/sustainment";

export interface HumanSustainmentCheck {
  action_id: string;
  action_title: string;
  assessment_name: string;
  validated_on: string;
  result: string;
  improvement_holding: boolean | null;
  repeatable: boolean | null;
  process_controlled: boolean | null;
  knowledge_documented: boolean | null;
  others_can_execute: boolean | null;
  performance_measured: boolean | null;
  capability_stable: boolean | null;
  notes: string | null;
}

export interface TelemetrySustainmentCheck {
  improvement_id: string;
  title: string;
  machine_label: string;
  part_number: string | null;
  changed_at: string;
  drift: DriftAssessment;
}

export interface SustainmentRollup {
  humanChecks: HumanSustainmentCheck[];
  telemetryChecks: TelemetrySustainmentCheck[];
  eventsAvailable: boolean;
}

// How far back "current" looks when checking whether an improvement's
// gains are still holding -- a week is enough to smooth out single-shift
// noise without looking so far back that a genuinely fresh regression
// gets diluted into the average.
const CURRENT_WINDOW_HOURS = 24 * 7;

export const getSustainmentRollup = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    return withUser(context.userId, async (client) => {
      // --- Human-reported: most recent validation per action ---
      const { rows: humanRows } = await client.query(
        `SELECT DISTINCT ON (v.action_id)
                v.action_id, a.recommended_action AS action_title,
                asmt.name AS assessment_name,
                v.validated_on, v.result,
                v.improvement_holding, v.repeatable, v.process_controlled,
                v.knowledge_documented, v.others_can_execute,
                v.performance_measured, v.capability_stable, v.notes
           FROM public.cap_validations v
           JOIN public.cap_actions a ON a.id = v.action_id
           JOIN public.cap_assessments asmt ON asmt.id = a.assessment_id
          ORDER BY v.action_id, v.validated_on DESC`,
      );
      const humanChecks: HumanSustainmentCheck[] = humanRows.map((r) => ({
        action_id: String(r.action_id),
        action_title: String(r.action_title),
        assessment_name: String(r.assessment_name),
        validated_on: String(r.validated_on),
        result: String(r.result),
        improvement_holding: r.improvement_holding,
        repeatable: r.repeatable,
        process_controlled: r.process_controlled,
        knowledge_documented: r.knowledge_documented,
        others_can_execute: r.others_can_execute,
        performance_measured: r.performance_measured,
        capability_stable: r.capability_stable,
        notes: r.notes == null ? null : String(r.notes),
      }));

      // --- Telemetry-verified: real Edge event drift check ---
      const table = await resolveMachineEventTable(client);
      if (!table) {
        return { humanChecks, telemetryChecks: [], eventsAvailable: false };
      }

      const { rows: improvementRows } = await client.query(
        `SELECT i.*, p.part_number,
                m.asset_id AS machine_asset_id,
                m.asset_id || ' — ' || m.name AS machine_label
           FROM public.shop_machine_improvements i
           JOIN public.shop_parts p ON p.id = i.part_id
           JOIN public.shop_machines m ON m.id = i.machine_id
          ORDER BY i.changed_at DESC`,
      );

      const telemetryChecks: TelemetrySustainmentCheck[] = [];
      for (const row of improvementRows) {
        const improvement: ShopMachineImprovement = {
          id: String(row.id),
          organization_id: String(row.organization_id),
          facility_id: String(row.facility_id),
          plant_id: String(row.facility_id),
          part_id: String(row.part_id),
          machine_id: String(row.machine_id),
          title: String(row.title),
          changed_at: String(row.changed_at),
          window_before_hours: Number(row.window_before_hours),
          window_after_hours: Number(row.window_after_hours),
          created_at: String(row.changed_at),
          updated_at: String(row.changed_at),
          part_number: row.part_number == null ? null : String(row.part_number),
          machine_asset_id:
            row.machine_asset_id == null ? null : String(row.machine_asset_id),
          machine_label:
            row.machine_label == null ? null : String(row.machine_label),
          plant_name: null,
        };
        const query = eventQueryFromImprovement(improvement);
        if (!query) continue;

        const changedAt = new Date(query.changed_at);
        const afterEnd = new Date(
          changedAt.getTime() + query.window_after_hours * 60 * 60 * 1000,
        );
        const now = new Date();
        const currentStart = new Date(
          now.getTime() - CURRENT_WINDOW_HOURS * 60 * 60 * 1000,
        );
        // Only meaningful once the original after-window has actually
        // finished, and there's a distinct, non-overlapping "current"
        // window after it to compare against.
        if (currentStart < afterEnd) continue;

        const fetchEvents = async (start: Date, end: Date) => {
          const { rows } = await client.query(
            `SELECT ts_utc, machine_id, part_id, program_name, event_type,
                    cycle_seq, cycle_time_s, idle_since_prev_cycle_s, gap_class
               FROM public.${table}
              WHERE machine_id = $1 AND part_id = $2 AND ts_utc >= $3 AND ts_utc < $4`,
            [
              query.machine_id,
              query.part_id,
              start.toISOString(),
              end.toISOString(),
            ],
          );
          return rows as MachineCaptureEvent[];
        };

        const comparison = computeImprovementBeforeAfter(
          query,
          await fetchEvents(new Date(changedAt.getTime()), afterEnd),
        );
        if (comparison.status !== "report") continue;

        const currentEvents = await fetchEvents(currentStart, now);
        const currentSummary =
          currentEvents.length > 0
            ? {
                status: "ok" as const,
                summary: summarizeCaptureEvents(currentEvents),
              }
            : { status: "empty" as const };

        telemetryChecks.push({
          improvement_id: improvement.id,
          title: improvement.title,
          machine_label:
            improvement.machine_label ??
            improvement.machine_asset_id ??
            "Unknown machine",
          part_number: improvement.part_number,
          changed_at: improvement.changed_at,
          drift: assessDrift(comparison.after, currentSummary),
        });
      }

      return { humanChecks, telemetryChecks, eventsAvailable: true };
    });
  });
