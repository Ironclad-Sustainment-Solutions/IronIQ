import { describe, expect, it } from "vitest";
import {
  CYCLE_EVENT_TYPE,
  SETUP_CANDIDATE_EVENT_TYPE,
  computeImprovementBeforeAfter,
  eventsForImprovementWindow,
  summarizeCaptureEvents,
  type MachineCaptureEvent,
} from "./machine-improvements";

const CHANGE = {
  machine_id: "m1",
  part_id: "p1",
  changed_at: "2026-08-15T12:00:00.000Z",
  window_before_hours: 24,
  window_after_hours: 24,
};

function event(
  partial: Partial<MachineCaptureEvent> &
    Pick<MachineCaptureEvent, "occurred_at" | "event_type">,
): MachineCaptureEvent {
  return {
    machine_id: CHANGE.machine_id,
    part_id: CHANGE.part_id,
    cycle_time_s: null,
    idle_s: null,
    cycles: null,
    ...partial,
  };
}

const beforeCycle = event({
  occurred_at: "2026-08-15T08:00:00.000Z",
  event_type: CYCLE_EVENT_TYPE,
  cycles: 10,
  cycle_time_s: 1200,
});
const beforeSetup = event({
  occurred_at: "2026-08-15T09:00:00.000Z",
  event_type: SETUP_CANDIDATE_EVENT_TYPE,
  idle_s: 600,
});
const afterCycle = event({
  occurred_at: "2026-08-15T14:00:00.000Z",
  event_type: CYCLE_EVENT_TYPE,
  cycles: 16,
  cycle_time_s: 960,
});
const afterSetup = event({
  occurred_at: "2026-08-15T15:00:00.000Z",
  event_type: SETUP_CANDIDATE_EVENT_TYPE,
  idle_s: 180,
});

describe("computeImprovementBeforeAfter", () => {
  it("computes different before/after totals from events around changed_at", () => {
    const comparison = computeImprovementBeforeAfter(CHANGE, [
      beforeCycle,
      beforeSetup,
      afterCycle,
      afterSetup,
    ]);
    expect(comparison.status).toBe("computed");
    if (comparison.status !== "computed") return;
    expect(comparison.before).toEqual({
      cycles: 10,
      cycle_time_s: 1200,
      setup_candidate_idle_s: 600,
      event_count: 2,
    });
    expect(comparison.after).toEqual({
      cycles: 16,
      cycle_time_s: 960,
      setup_candidate_idle_s: 180,
      event_count: 2,
    });
    expect(comparison.after.cycles).not.toBe(comparison.before.cycles);
    expect(comparison.after.cycle_time_s).not.toBe(
      comparison.before.cycle_time_s,
    );
    expect(comparison.after.setup_candidate_idle_s).not.toBe(
      comparison.before.setup_candidate_idle_s,
    );
  });

  it("does not fake success when the events table is missing", () => {
    const comparison = computeImprovementBeforeAfter(CHANGE, null);
    expect(comparison).toMatchObject({
      status: "cannot_compute",
      reason: "events_unavailable",
    });
  });

  it("does not fake success when a window has no events", () => {
    const comparison = computeImprovementBeforeAfter(CHANGE, [
      beforeCycle,
      beforeSetup,
    ]);
    expect(comparison).toMatchObject({
      status: "cannot_compute",
      reason: "empty_window",
    });
  });

  it("puts an event at changed_at in the after window, not before", () => {
    const atChange = event({
      occurred_at: CHANGE.changed_at,
      event_type: CYCLE_EVENT_TYPE,
      cycles: 1,
      cycle_time_s: 10,
    });
    expect(
      eventsForImprovementWindow([atChange], CHANGE, "before"),
    ).toHaveLength(0);
    expect(eventsForImprovementWindow([atChange], CHANGE, "after")).toEqual([
      atChange,
    ]);
  });

  it("ignores events outside the windows or on another machine/part", () => {
    const tooEarly = event({
      occurred_at: "2026-08-13T12:00:00.000Z",
      event_type: CYCLE_EVENT_TYPE,
      cycles: 99,
      cycle_time_s: 99,
    });
    const otherMachine = event({
      occurred_at: "2026-08-15T08:00:00.000Z",
      event_type: CYCLE_EVENT_TYPE,
      machine_id: "other",
      cycles: 50,
      cycle_time_s: 50,
    });
    const before = eventsForImprovementWindow(
      [beforeCycle, tooEarly, otherMachine, afterCycle],
      CHANGE,
      "before",
    );
    expect(before).toEqual([beforeCycle]);
  });
});

describe("summarizeCaptureEvents", () => {
  it("sums CYCLE cycle_time_s separately from SETUP_CANDIDATE idle", () => {
    const summary = summarizeCaptureEvents([beforeCycle, beforeSetup]);
    expect(summary.cycles).toBe(10);
    expect(summary.cycle_time_s).toBe(1200);
    expect(summary.setup_candidate_idle_s).toBe(600);
  });
});
