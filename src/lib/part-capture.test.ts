import { describe, expect, it } from "vitest";
import {
  SETUP_CANDIDATE,
  hoursToMakePart,
  summarizePartCapture,
  type ShopMachineEvent,
} from "./part-capture";

const SHOP_MACHINE_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

function event(
  partial: Partial<ShopMachineEvent> &
    Pick<ShopMachineEvent, "event_type" | "ts_utc">,
): ShopMachineEvent {
  return {
    id: partial.id ?? crypto.randomUUID(),
    organization_id: "org-1",
    facility_id: "fac-1",
    shop_machine_id: partial.shop_machine_id ?? SHOP_MACHINE_ID,
    machine_id: partial.machine_id ?? "MC-UMC750-01",
    machine_name: partial.machine_name ?? "UMC-750",
    program_name:
      partial.program_name === undefined ? "O5123" : partial.program_name,
    part_id: partial.part_id === undefined ? "38742" : partial.part_id,
    cycle_time_s: partial.cycle_time_s ?? null,
    idle_since_prev_cycle_s: partial.idle_since_prev_cycle_s ?? null,
    gap_class: partial.gap_class ?? null,
    ...partial,
  };
}

describe("summarizePartCapture", () => {
  it("sums cycle_time_s for cycle_end events on part 38742 / MC-UMC750-01 and lists SETUP_CANDIDATE gaps", () => {
    const rows: ShopMachineEvent[] = [
      event({
        id: "c1",
        event_type: "cycle_end",
        ts_utc: "2026-08-20T08:00:00Z",
        part_id: "38742",
        machine_id: "MC-UMC750-01",
        cycle_time_s: 142.5,
      }),
      event({
        id: "c2",
        event_type: "cycle_end",
        ts_utc: "2026-08-20T08:12:00Z",
        part_id: "38742",
        machine_id: "MC-UMC750-01",
        cycle_time_s: 139,
        idle_since_prev_cycle_s: 480,
        gap_class: SETUP_CANDIDATE,
      }),
      event({
        id: "state",
        event_type: "state_change",
        ts_utc: "2026-08-20T07:59:00Z",
        part_id: "38742",
        machine_id: "MC-UMC750-01",
      }),
      event({
        id: "unmapped",
        event_type: "cycle_end",
        ts_utc: "2026-08-20T09:00:00Z",
        part_id: null,
        program_name: "O9999",
        machine_id: "MC-UMC750-01",
        cycle_time_s: 999,
        idle_since_prev_cycle_s: 960,
        gap_class: SETUP_CANDIDATE,
      }),
      event({
        id: "other-part",
        event_type: "cycle_end",
        ts_utc: "2026-08-20T10:00:00Z",
        part_id: "11007",
        machine_id: "MC-UMC750-01",
        cycle_time_s: 50,
      }),
    ];

    const summary = summarizePartCapture(rows, "38742");

    expect(summary.cycles).toBe(2);
    expect(summary.cycle_time_s).toBe(281.5);
    expect(summary.cycle_time_s).toBe(142.5 + 139);
    expect(summary.machines).toEqual([
      {
        shop_machine_id: SHOP_MACHINE_ID,
        machine_id: "MC-UMC750-01",
        machine_name: "UMC-750",
        cycles: 2,
        cycle_time_s: 281.5,
      },
    ]);
    expect(summary.setup_candidate_gaps).toHaveLength(1);
    expect(summary.setup_candidate_gaps[0]).toMatchObject({
      id: "c2",
      machine_id: "MC-UMC750-01",
      idle_since_prev_cycle_s: 480,
      gap_class: SETUP_CANDIDATE,
    });
    expect(summary.attributed_idle_s).toBe(480);
    expect(summary.hours_to_make_part).toBe(hoursToMakePart(281.5, 480));
    expect(summary.hours_to_make_part).toBe(
      Math.round(((281.5 + 480) / 3600) * 1e4) / 1e4,
    );
    expect(summary.machines.every((m) => m.machine_id === "MC-UMC750-01")).toBe(
      true,
    );
  });

  it("does not include unmapped (null part_id) events in this view", () => {
    const rows: ShopMachineEvent[] = [
      event({
        event_type: "cycle_end",
        ts_utc: "2026-08-20T08:00:00Z",
        part_id: null,
        program_name: "O5123",
        cycle_time_s: 200,
        idle_since_prev_cycle_s: 90,
        gap_class: SETUP_CANDIDATE,
      }),
    ];
    const summary = summarizePartCapture(rows, "38742");
    expect(summary.cycles).toBe(0);
    expect(summary.cycle_time_s).toBe(0);
    expect(summary.setup_candidate_gaps).toEqual([]);
    expect(summary.machines).toEqual([]);
    expect(summary.hours_to_make_part).toBe(0);
  });

  it("returns an empty summary when a part has no events yet", () => {
    const summary = summarizePartCapture([], "38742");
    expect(summary.cycles).toBe(0);
    expect(summary.cycle_time_s).toBe(0);
    expect(summary.setup_candidate_gaps).toEqual([]);
    expect(summary.hours_to_make_part).toBe(0);
  });
});
