/**
 * V1 part capture view: event-derived totals for a searched part_id.
 *
 * Hours to make a part is derived here (sum of cycle_time_s + attributed
 * SETUP_CANDIDATE idle). It is not a CNC tag and is not read from the control.
 *
 * Event rows come from public.machine_events (sibling ingest PR). This
 * module does not define that table.
 */

import type { ShopPart } from "@/lib/shop-floor";

export const CYCLE_END = "cycle_end";
export const IDLE_GAP = "idle_gap";
export const SETUP_CANDIDATE = "SETUP_CANDIDATE";

export type MachineEventType = typeof CYCLE_END | typeof IDLE_GAP;
export type IdleGapTag = typeof SETUP_CANDIDATE;

/**
 * Row shape matching the ingest spec for public.machine_events.
 * part_id is null when the program has not been mapped to a shop part.
 */
export interface MachineEvent {
  id: string;
  organization_id: string;
  facility_id: string;
  machine_id: string;
  asset_id: string;
  machine_name: string | null;
  occurred_at: string;
  event_type: string;
  part_id: string | null;
  cycle_time_s: number | null;
  idle_time_s: number | null;
  idle_tag: string | null;
}

export interface PartMachineTotal {
  machine_id: string;
  asset_id: string;
  machine_name: string | null;
  cycles: number;
  cycle_time_s: number;
}

export interface SetupCandidateGap {
  id: string;
  machine_id: string;
  asset_id: string;
  machine_name: string | null;
  occurred_at: string;
  idle_time_s: number;
  idle_tag: typeof SETUP_CANDIDATE;
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
  return eventType.toLowerCase() === CYCLE_END;
}

export function isSetupCandidateTag(tag: string | null | undefined): boolean {
  return tag === SETUP_CANDIDATE;
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
  event: MachineEvent,
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
  events: MachineEvent[],
  partId: string,
  shopPart: ShopPart | null = null,
): PartCaptureSummary {
  const scoped = events.filter((event) =>
    eventMatchesPart(event, partId, shopPart),
  );
  const cycleEnds = scoped.filter((event) => isCycleEnd(event.event_type));
  const gaps = scoped.filter(
    (event) =>
      isSetupCandidateTag(event.idle_tag) &&
      event.idle_time_s != null &&
      Number(event.idle_time_s) >= 0,
  );

  const byMachine = new Map<string, PartMachineTotal>();
  let cycle_time_s = 0;
  for (const event of cycleEnds) {
    const seconds = Number(event.cycle_time_s) || 0;
    cycle_time_s += seconds;
    const current = byMachine.get(event.machine_id) ?? {
      machine_id: event.machine_id,
      asset_id: event.asset_id,
      machine_name: event.machine_name,
      cycles: 0,
      cycle_time_s: 0,
    };
    current.cycles += 1;
    current.cycle_time_s += seconds;
    byMachine.set(event.machine_id, current);
  }

  const attributed_idle_s = gaps.reduce(
    (sum, event) => sum + Number(event.idle_time_s),
    0,
  );

  return {
    part_id: partId,
    shop_part: shopPart,
    machines: [...byMachine.values()].sort((a, b) =>
      a.asset_id.localeCompare(b.asset_id),
    ),
    cycles: cycleEnds.length,
    cycle_time_s,
    attributed_idle_s,
    hours_to_make_part: hoursToMakePart(cycle_time_s, attributed_idle_s),
    setup_candidate_gaps: gaps.map((event) => ({
      id: event.id,
      machine_id: event.machine_id,
      asset_id: event.asset_id,
      machine_name: event.machine_name,
      occurred_at: event.occurred_at,
      idle_time_s: Number(event.idle_time_s),
      idle_tag: SETUP_CANDIDATE,
    })),
  };
}
