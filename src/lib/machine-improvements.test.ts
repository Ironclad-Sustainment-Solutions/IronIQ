import { describe, expect, it } from "vitest";
import {
  CYCLE_END_EVENT_TYPE,
  EMPTY_WINDOW_MESSAGE,
  FIRST_PIECE_CANDIDATE_GAP_CLASS,
  SETUP_CANDIDATE_GAP_CLASS,
  computeImprovementBeforeAfter,
  eventsForImprovementWindow,
  firstPieceLostHours,
  formatHours,
  formatHoursDelta,
  hoursToMakePart,
  setupLostHours,
  summarizeCaptureEvents,
  type MachineCaptureEvent,
} from "./machine-improvements";

const CHANGE = {
  machine_id: "MC-UMC750-01",
  part_id: "HUB-4410",
  changed_at: "2026-08-15T12:00:00.000Z",
  window_before_hours: 24,
  window_after_hours: 24,
};

function event(
  partial: Partial<MachineCaptureEvent> &
    Pick<MachineCaptureEvent, "ts_utc" | "event_type">,
): MachineCaptureEvent {
  return {
    machine_id: CHANGE.machine_id,
    part_id: CHANGE.part_id,
    program_name: "O5123",
    cycle_seq: null,
    cycle_time_s: null,
    idle_since_prev_cycle_s: null,
    gap_class: null,
    ...partial,
  };
}

const beforeCycleA = event({
  ts_utc: "2026-08-15T08:00:00.000Z",
  event_type: CYCLE_END_EVENT_TYPE,
  cycle_seq: 40,
  cycle_time_s: 200,
  idle_since_prev_cycle_s: 30,
});
const beforeCycleB = event({
  ts_utc: "2026-08-15T09:00:00.000Z",
  event_type: CYCLE_END_EVENT_TYPE,
  cycle_seq: 41,
  cycle_time_s: 187.4,
  idle_since_prev_cycle_s: 960,
  gap_class: SETUP_CANDIDATE_GAP_CLASS,
});
const beforeHeartbeat = event({
  ts_utc: "2026-08-15T09:05:00.000Z",
  event_type: "heartbeat",
});
const afterCycleA = event({
  ts_utc: "2026-08-15T14:00:00.000Z",
  event_type: CYCLE_END_EVENT_TYPE,
  cycle_seq: 50,
  cycle_time_s: 142,
  idle_since_prev_cycle_s: 20,
});
const afterCycleB = event({
  ts_utc: "2026-08-15T15:00:00.000Z",
  event_type: CYCLE_END_EVENT_TYPE,
  cycle_seq: 51,
  cycle_time_s: 138,
  idle_since_prev_cycle_s: 180,
  gap_class: SETUP_CANDIDATE_GAP_CLASS,
});
const afterCycleC = event({
  ts_utc: "2026-08-15T16:00:00.000Z",
  event_type: CYCLE_END_EVENT_TYPE,
  cycle_seq: 52,
  cycle_time_s: 140,
  idle_since_prev_cycle_s: 15,
});

describe("computeImprovementBeforeAfter", () => {
  it("computes different baseline vs after totals from ingest-shaped events", () => {
    const comparison = computeImprovementBeforeAfter(CHANGE, [
      beforeCycleA,
      beforeCycleB,
      beforeHeartbeat,
      afterCycleA,
      afterCycleB,
      afterCycleC,
    ]);
    expect(comparison.status).toBe("report");
    if (comparison.status !== "report") return;
    expect(comparison.before.status).toBe("ok");
    expect(comparison.after.status).toBe("ok");
    if (comparison.before.status !== "ok" || comparison.after.status !== "ok") {
      return;
    }
    expect(comparison.before.summary).toEqual({
      cycles: 2,
      cycle_time_s: 387.4,
      setup_candidate_idle_s: 960,
      first_piece_candidate_idle_s: 0,
      event_count: 3,
    });
    expect(comparison.after.summary).toEqual({
      cycles: 3,
      cycle_time_s: 420,
      setup_candidate_idle_s: 180,
      first_piece_candidate_idle_s: 0,
      event_count: 3,
    });
    expect(comparison.after.summary.cycles).not.toBe(
      comparison.before.summary.cycles,
    );
    expect(hoursToMakePart(comparison.before.summary)).toBe(0.374);
    expect(hoursToMakePart(comparison.after.summary)).toBe(0.167);
    expect(formatHoursDelta(0.374, 0.167)).toBe("0.21 hours recovered");
    expect(formatHoursDelta(0.167, 0.374)).toBe("0.21 hours worse");
  });

  it("does not fake zeros when the events table is missing", () => {
    const comparison = computeImprovementBeforeAfter(CHANGE, null);
    expect(comparison).toMatchObject({
      status: "unavailable",
      reason: "events_unavailable",
    });
  });

  it("marks an empty window instead of inventing zeros", () => {
    const comparison = computeImprovementBeforeAfter(CHANGE, [
      beforeCycleA,
      beforeCycleB,
    ]);
    expect(comparison.status).toBe("report");
    if (comparison.status !== "report") return;
    expect(comparison.before.status).toBe("ok");
    expect(comparison.after).toEqual({ status: "empty" });
    expect(EMPTY_WINDOW_MESSAGE).toBe("No events in this window yet.");
  });

  it("puts an event at changed_at in the after window, not before", () => {
    const atChange = event({
      ts_utc: CHANGE.changed_at,
      event_type: CYCLE_END_EVENT_TYPE,
      cycle_seq: 42,
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
      ts_utc: "2026-08-13T12:00:00.000Z",
      event_type: CYCLE_END_EVENT_TYPE,
      cycle_seq: 1,
      cycle_time_s: 99,
    });
    const otherMachine = event({
      ts_utc: "2026-08-15T08:00:00.000Z",
      event_type: CYCLE_END_EVENT_TYPE,
      machine_id: "MC-OTHER",
      cycle_seq: 99,
      cycle_time_s: 50,
    });
    const otherPart = event({
      ts_utc: "2026-08-15T08:00:00.000Z",
      event_type: CYCLE_END_EVENT_TYPE,
      part_id: "BRK-220",
      cycle_seq: 98,
      cycle_time_s: 50,
    });
    const before = eventsForImprovementWindow(
      [beforeCycleA, tooEarly, otherMachine, otherPart, afterCycleA],
      CHANGE,
      "before",
    );
    expect(before).toEqual([beforeCycleA]);
  });
});

describe("summarizeCaptureEvents", () => {
  it("counts cycle_end + cycle_seq, sums cycle_time_s, and SETUP_CANDIDATE idle from gap_class", () => {
    const summary = summarizeCaptureEvents([
      beforeCycleA,
      beforeCycleB,
      beforeHeartbeat,
      event({
        ts_utc: "2026-08-15T09:10:00.000Z",
        event_type: "state_change",
      }),
      event({
        ts_utc: "2026-08-15T09:11:00.000Z",
        event_type: "alarm",
      }),
    ]);
    expect(summary.cycles).toBe(2);
    expect(summary.cycle_time_s).toBe(387.4);
    expect(summary.setup_candidate_idle_s).toBe(960);
    expect(hoursToMakePart(summary)).toBe(0.374);
    expect(setupLostHours(summary)).toBe(0.267);
    expect(formatHours(0.267)).toBe("0.27 hours");
  });

  it("tracks FIRST_PIECE_CANDIDATE idle separately when present", () => {
    const summary = summarizeCaptureEvents([
      beforeCycleA,
      event({
        ts_utc: "2026-08-15T09:30:00.000Z",
        event_type: CYCLE_END_EVENT_TYPE,
        cycle_seq: 42,
        cycle_time_s: 50,
        idle_since_prev_cycle_s: 720,
        gap_class: FIRST_PIECE_CANDIDATE_GAP_CLASS,
      }),
    ]);
    expect(summary.first_piece_candidate_idle_s).toBe(720);
    expect(firstPieceLostHours(summary)).toBe(0.2);
    expect(summary.setup_candidate_idle_s).toBe(0);
    expect(hoursToMakePart(summary)).toBe(0.069);
  });

  it("does not treat SETUP_CANDIDATE or CYCLE as event_type", () => {
    const summary = summarizeCaptureEvents([
      event({
        ts_utc: "2026-08-15T08:00:00.000Z",
        event_type: "SETUP_CANDIDATE",
        cycle_time_s: 999,
        idle_since_prev_cycle_s: 999,
      }),
      event({
        ts_utc: "2026-08-15T08:01:00.000Z",
        event_type: "CYCLE",
        cycle_seq: 10,
        cycle_time_s: 100,
      }),
    ]);
    expect(summary.cycles).toBe(0);
    expect(summary.cycle_time_s).toBe(0);
    expect(summary.setup_candidate_idle_s).toBe(0);
    expect(summary.first_piece_candidate_idle_s).toBe(0);
  });
});
