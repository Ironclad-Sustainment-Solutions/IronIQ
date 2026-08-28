import { describe, expect, it } from "vitest";
import {
  SETUP_CANDIDATE,
  hoursToMakePart,
  summarizePartCapture,
  type MachineEvent,
} from "./part-capture";

function event(
  partial: Partial<MachineEvent> &
    Pick<MachineEvent, "event_type" | "occurred_at">,
): MachineEvent {
  return {
    id: partial.id ?? crypto.randomUUID(),
    organization_id: "org-1",
    facility_id: "fac-1",
    machine_id: partial.machine_id ?? "mc-umc750-01-id",
    asset_id: partial.asset_id ?? "MC-UMC750-01",
    machine_name: partial.machine_name ?? "UMC-750",
    part_id: partial.part_id === undefined ? "38742" : partial.part_id,
    cycle_time_s: partial.cycle_time_s ?? null,
    idle_time_s: partial.idle_time_s ?? null,
    idle_tag: partial.idle_tag ?? null,
    ...partial,
  };
}

describe("summarizePartCapture", () => {
  it("sums cycle_time_s for cycle_end events on part 38742 / MC-UMC750-01 and lists SETUP_CANDIDATE gaps", () => {
    const rows: MachineEvent[] = [
      event({
        id: "c1",
        event_type: "cycle_end",
        occurred_at: "2026-08-20T08:00:00Z",
        part_id: "38742",
        asset_id: "MC-UMC750-01",
        cycle_time_s: 142.5,
      }),
      event({
        id: "gap1",
        event_type: "idle_gap",
        occurred_at: "2026-08-20T08:03:00Z",
        part_id: "38742",
        asset_id: "MC-UMC750-01",
        idle_time_s: 480,
        idle_tag: SETUP_CANDIDATE,
      }),
      event({
        id: "c2",
        event_type: "cycle_end",
        occurred_at: "2026-08-20T08:12:00Z",
        part_id: "38742",
        asset_id: "MC-UMC750-01",
        cycle_time_s: 139,
      }),
      event({
        id: "unmapped",
        event_type: "cycle_end",
        occurred_at: "2026-08-20T09:00:00Z",
        part_id: null,
        asset_id: "MC-UMC750-01",
        cycle_time_s: 999,
      }),
      event({
        id: "other-part",
        event_type: "cycle_end",
        occurred_at: "2026-08-20T10:00:00Z",
        part_id: "11007",
        asset_id: "MC-UMC750-01",
        cycle_time_s: 50,
      }),
    ];

    const summary = summarizePartCapture(rows, "38742");

    expect(summary.cycles).toBe(2);
    expect(summary.cycle_time_s).toBe(281.5);
    expect(summary.cycle_time_s).toBe(142.5 + 139);
    expect(summary.machines).toEqual([
      {
        machine_id: "mc-umc750-01-id",
        asset_id: "MC-UMC750-01",
        machine_name: "UMC-750",
        cycles: 2,
        cycle_time_s: 281.5,
      },
    ]);
    expect(summary.setup_candidate_gaps).toHaveLength(1);
    expect(summary.setup_candidate_gaps[0]).toMatchObject({
      id: "gap1",
      asset_id: "MC-UMC750-01",
      idle_time_s: 480,
      idle_tag: SETUP_CANDIDATE,
    });
    expect(summary.attributed_idle_s).toBe(480);
    expect(summary.hours_to_make_part).toBe(hoursToMakePart(281.5, 480));
    expect(summary.hours_to_make_part).toBe(
      Math.round(((281.5 + 480) / 3600) * 1e4) / 1e4,
    );
    expect(summary.machines.every((m) => m.asset_id === "MC-UMC750-01")).toBe(
      true,
    );
  });

  it("does not include unmapped (null part_id) events in this view", () => {
    const rows: MachineEvent[] = [
      event({
        event_type: "cycle_end",
        occurred_at: "2026-08-20T08:00:00Z",
        part_id: null,
        cycle_time_s: 200,
        idle_time_s: 90,
        idle_tag: SETUP_CANDIDATE,
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
