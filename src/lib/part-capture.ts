/**
 * V1 part capture view: event-derived totals for a searched part_id.
 *
 * Hours to make a part is derived here (sum of cycle_time_s + attributed
 * SETUP_CANDIDATE idle_since_prev_cycle_s). It is not a CNC tag.
 *
 * Rows come from public.shop_machine_events (ingest PR, iss.machine_event.v1).
 * This module does not create that table.
 */

import type { ShopPart } from "@/lib/shop-floor";

export const CYCLE_END = "cycle_end";
export const SETUP_CANDIDATE = "SETUP_CANDIDATE";

export const MACHINE_EVENT_TYPES = [
  "state_change",
  "cycle_end",
  "alarm",
  "heartbeat",
] as const;
export type MachineEventType = (typeof MACHINE_EVENT_TYPES)[number];

/**
 * Stored row from public.shop_machine_events, matching iss.machine_event.v1.
 * machine_id is shop_machines.asset_id. part_id is null when unmapped.
 */
export interface ShopMachineEvent {
  id: string;
  organization_id: string;
  facility_id: string;
  shop_machine_id: string;
  machine_id: string;
  machine_name: string | null;
  ts_utc: string;
  event_type: string;
  program_name: string | null;
  part_id: string | null;
  cycle_time_s: number | null;
  idle_since_prev_cycle_s: number | null;
  gap_class: string | null;
}

export interface PartMachineTotal {
  shop_machine_id: string;
  machine_id: string;
  machine_name: string | null;
  cycles: number;
  cycle_time_s: number;
}

export interface SetupCandidateGap {
  id: string;
  shop_machine_id: string;
  machine_id: string;
  machine_name: string | null;
  ts_utc: string;
  idle_since_prev_cycle_s: number;
  gap_class: typeof SETUP_CANDIDATE;
}

export interface PartCaptureSummary {
  part_id: string;
  shop_part: ShopPart | null;
  machines: PartMachineTotal[];
  cycles: number;
  cycle_time_s: number;
  attributed_idle_s: number;
  hours_to_make_part: number;
  setup_candidate_gaps: SetupCandidateGap[];
}

export function isCycleEnd(eventType: string): boolean {
  return eventType === CYCLE_END;
}

export function isSetupCandidateGap(
  gapClass: string | null | undefined,
): boolean {
  return gapClass === SETUP_CANDIDATE;
}

/** Hours = (sum cycle_time_s + attributed idle seconds) / 3600. */
export function hoursToMakePart(
  cycleTimeS: number,
  attributedIdleS: number,
): number {
  return Math.round(((cycleTimeS + attributedIdleS) / 3600) * 1e4) / 1e4;
}

export function emptyPartCaptureSummary(
  partId: string,
  shopPart: ShopPart | null = null,
): PartCaptureSummary {
  return {
    part_id: partId,
    shop_part: shopPart,
    machines: [],
    cycles: 0,
    cycle_time_s: 0,
    attributed_idle_s: 0,
    hours_to_make_part: 0,
    setup_candidate_gaps: [],
  };
}

function eventMatchesPart(
  event: ShopMachineEvent,
  partId: string,
  shopPart?: ShopPart | null,
): boolean {
  if (event.part_id == null || event.part_id === "") return false;
  if (event.part_id === partId) return true;
  if (
    shopPart &&
    (event.part_id === shopPart.id || event.part_id === shopPart.part_number)
  ) {
    return true;
  }
  return false;
}

/**
 * Totals for one part_id. Events with null part_id (unmapped program) never
 * appear — even if they were passed in by mistake.
 */
export function summarizePartCapture(
  events: ShopMachineEvent[],
  partId: string,
  shopPart: ShopPart | null = null,
): PartCaptureSummary {
  const scoped = events.filter((event) =>
    eventMatchesPart(event, partId, shopPart),
  );
  const cycleEnds = scoped.filter((event) => isCycleEnd(event.event_type));
  const gaps = scoped.filter(
    (event) =>
      isSetupCandidateGap(event.gap_class) &&
      event.idle_since_prev_cycle_s != null &&
      Number(event.idle_since_prev_cycle_s) >= 0,
  );

  const byMachine = new Map<string, PartMachineTotal>();
  let cycle_time_s = 0;
  for (const event of cycleEnds) {
    const seconds = Number(event.cycle_time_s) || 0;
    cycle_time_s += seconds;
    const current = byMachine.get(event.shop_machine_id) ?? {
      shop_machine_id: event.shop_machine_id,
      machine_id: event.machine_id,
      machine_name: event.machine_name,
      cycles: 0,
      cycle_time_s: 0,
    };
    current.cycles += 1;
    current.cycle_time_s += seconds;
    byMachine.set(event.shop_machine_id, current);
  }

  const attributed_idle_s = gaps.reduce(
    (sum, event) => sum + Number(event.idle_since_prev_cycle_s),
    0,
  );

  return {
    part_id: partId,
    shop_part: shopPart,
    machines: [...byMachine.values()].sort((a, b) =>
      a.machine_id.localeCompare(b.machine_id),
    ),
    cycles: cycleEnds.length,
    cycle_time_s,
    attributed_idle_s,
    hours_to_make_part: hoursToMakePart(cycle_time_s, attributed_idle_s),
    setup_candidate_gaps: gaps.map((event) => ({
      id: event.id,
      shop_machine_id: event.shop_machine_id,
      machine_id: event.machine_id,
      machine_name: event.machine_name,
      ts_utc: event.ts_utc,
      idle_since_prev_cycle_s: Number(event.idle_since_prev_cycle_s),
      gap_class: SETUP_CANDIDATE,
    })),
  };
}
