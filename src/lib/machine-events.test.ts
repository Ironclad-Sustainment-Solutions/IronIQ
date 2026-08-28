import { describe, expect, it } from "vitest";
import {
  buildFloorMachineRow,
  buildFloorView,
  currentPartOrProgram,
  formatFloorHours,
  isCycleEndEventType,
  isHeartbeatEventType,
  parseFloorWindow,
  resolveFloorState,
  type FloorMachineIdentity,
  type MachineEvent,
} from "./machine-events";

const machine: FloorMachineIdentity = {
  id: "11111111-1111-1111-1111-111111111111",
  asset_id: "HMC-12",
  name: "Horizontal 12",
  make: "Mazak",
  model: "HCN-5000",
  location: "Cell A",
};

function event(
  partial: Partial<MachineEvent> &
    Pick<MachineEvent, "occurred_at" | "event_type">,
): MachineEvent {
  return {
    id: partial.id ?? crypto.randomUUID(),
    organization_id: "org",
    facility_id: "fac",
    machine_id: machine.asset_id,
    state: null,
    part_id: null,
    program_name: null,
    ...partial,
  };
}

const dayStart = new Date("2026-08-28T00:00:00.000Z");
const noon = new Date("2026-08-28T12:00:00.000Z");

describe("event type helpers", () => {
  it("treats heartbeat variants as heartbeats", () => {
    expect(isHeartbeatEventType("heartbeat")).toBe(true);
    expect(isHeartbeatEventType("HEARTBEAT")).toBe(true);
    expect(isHeartbeatEventType("ping")).toBe(true);
    expect(isHeartbeatEventType("cycle_end")).toBe(false);
  });

  it("counts cycle_end variants", () => {
    expect(isCycleEndEventType("cycle_end")).toBe(true);
    expect(isCycleEndEventType("cycle-end")).toBe(true);
    expect(isCycleEndEventType("cycle_start")).toBe(false);
  });
});

describe("resolveFloorState", () => {
  it("uses the state column when present", () => {
    expect(
      resolveFloorState({ event_type: "cycle_end", state: "RUNNING" }),
    ).toBe("RUNNING");
    expect(resolveFloorState({ event_type: "alarm", state: "DOWN" })).toBe(
      "DOWN",
    );
    expect(resolveFloorState({ event_type: "status", state: "idle" })).toBe(
      "IDLE",
    );
  });

  it("maps clear event types when state is absent", () => {
    expect(resolveFloorState({ event_type: "cycle_start", state: null })).toBe(
      "RUNNING",
    );
    expect(resolveFloorState({ event_type: "idle", state: null })).toBe("IDLE");
    expect(resolveFloorState({ event_type: "down", state: null })).toBe("DOWN");
  });

  it("does not guess a color from cycle_end without state", () => {
    expect(resolveFloorState({ event_type: "cycle_end", state: null })).toBe(
      null,
    );
  });
});

describe("currentPartOrProgram", () => {
  it("prefers program_name when part_id is null", () => {
    expect(currentPartOrProgram({ part_id: null, program_name: "O1234" })).toBe(
      "O1234",
    );
  });

  it("uses part_id when present", () => {
    expect(
      currentPartOrProgram({ part_id: "HUB-4410", program_name: "O1234" }),
    ).toBe("HUB-4410");
  });
});

describe("buildFloorMachineRow", () => {
  it("shows not connected when there are no events — no fake RUNNING", () => {
    const row = buildFloorMachineRow(machine, [], dayStart, noon);
    expect(row.connected).toBe(false);
    expect(row.state).toBeNull();
    expect(row.cyclesToday).toBe(0);
    expect(row.runHours).toBe(0);
    expect(row.idleHours).toBe(0);
    expect(row.timeline).toEqual([]);
    expect(row.currentPartOrProgram).toBeNull();
  });

  it("does not take color from heartbeats alone", () => {
    const row = buildFloorMachineRow(
      machine,
      [
        event({
          occurred_at: "2026-08-28T08:00:00.000Z",
          event_type: "heartbeat",
          state: "RUNNING",
          program_name: "O9",
        }),
      ],
      dayStart,
      noon,
    );
    expect(row.connected).toBe(false);
    expect(row.state).toBeNull();
    expect(row.currentPartOrProgram).toBeNull();
    expect(row.timeline).toEqual([]);
  });

  it("uses the latest non-heartbeat event for color and part/program", () => {
    const row = buildFloorMachineRow(
      machine,
      [
        event({
          occurred_at: "2026-08-28T07:00:00.000Z",
          event_type: "cycle_start",
          state: "RUNNING",
          part_id: "OLD",
        }),
        event({
          occurred_at: "2026-08-28T09:00:00.000Z",
          event_type: "heartbeat",
          state: "RUNNING",
        }),
        event({
          occurred_at: "2026-08-28T10:00:00.000Z",
          event_type: "idle",
          program_name: "O5555",
        }),
        event({
          occurred_at: "2026-08-28T11:00:00.000Z",
          event_type: "heartbeat",
        }),
      ],
      dayStart,
      noon,
    );
    expect(row.state).toBe("IDLE");
    expect(row.currentPartOrProgram).toBe("O5555");
  });

  it("counts cycle_end today only", () => {
    const row = buildFloorMachineRow(
      machine,
      [
        event({
          occurred_at: "2026-08-27T22:00:00.000Z",
          event_type: "cycle_end",
          state: "RUNNING",
        }),
        event({
          occurred_at: "2026-08-28T08:00:00.000Z",
          event_type: "cycle_end",
          state: "RUNNING",
          part_id: "HUB-4410",
        }),
        event({
          occurred_at: "2026-08-28T09:30:00.000Z",
          event_type: "cycle_end",
          state: "RUNNING",
          part_id: "HUB-4410",
        }),
        event({
          occurred_at: "2026-08-28T16:00:00.000Z",
          event_type: "cycle_end",
          state: "RUNNING",
        }),
      ],
      dayStart,
      noon,
    );
    expect(row.cyclesToday).toBe(2);
    expect(row.state).toBe("RUNNING");
    expect(row.currentPartOrProgram).toBe("HUB-4410");
  });

  it("attributes run and idle hours from the day's event timeline", () => {
    const row = buildFloorMachineRow(
      machine,
      [
        event({
          occurred_at: "2026-08-27T22:00:00.000Z",
          event_type: "cycle_start",
          state: "RUNNING",
        }),
        event({
          occurred_at: "2026-08-28T02:00:00.000Z",
          event_type: "idle",
        }),
        event({
          occurred_at: "2026-08-28T06:00:00.000Z",
          event_type: "cycle_start",
          state: "RUNNING",
          part_id: "BRK-220",
        }),
        event({
          occurred_at: "2026-08-28T08:00:00.000Z",
          event_type: "down",
        }),
      ],
      dayStart,
      noon,
    );
    // 00:00–02:00 RUNNING (2h), 02:00–06:00 IDLE (4h), 06:00–08:00 RUNNING (2h), 08:00–12:00 DOWN (ignored)
    expect(row.runHours).toBe(4);
    expect(row.idleHours).toBe(4);
    expect(row.state).toBe("DOWN");
    expect(row.timeline.length).toBeGreaterThan(0);
    expect(row.timeline[0]?.state).toBe("RUNNING");
  });

  it("does not paint a color when the latest non-heartbeat has no state", () => {
    const row = buildFloorMachineRow(
      machine,
      [
        event({
          occurred_at: "2026-08-28T08:00:00.000Z",
          event_type: "cycle_start",
          state: "RUNNING",
          part_id: "HUB-4410",
        }),
        event({
          occurred_at: "2026-08-28T09:00:00.000Z",
          event_type: "cycle_end",
          part_id: "HUB-4410",
        }),
      ],
      dayStart,
      noon,
    );
    expect(row.cyclesToday).toBe(1);
    expect(row.state).toBeNull();
    expect(row.currentPartOrProgram).toBe("HUB-4410");
    expect(row.runHours).toBe(4);
  });
});

describe("buildFloorView", () => {
  it("returns empty not-connected rows when the events table is unavailable", () => {
    const view = buildFloorView({
      machines: [machine],
      events: [
        event({
          occurred_at: "2026-08-28T08:00:00.000Z",
          event_type: "cycle_start",
          state: "RUNNING",
        }),
      ],
      eventsAvailable: false,
      windowStart: dayStart,
      windowEnd: noon,
    });
    expect(view.eventsAvailable).toBe(false);
    expect(view.rows).toHaveLength(1);
    expect(view.rows[0].connected).toBe(false);
    expect(view.rows[0].state).toBeNull();
    expect(view.rows[0].runHours).toBe(0);
  });

  it("keys events by spec machine_id = asset_id", () => {
    const other = event({
      machine_id: "OTHER",
      occurred_at: "2026-08-28T08:00:00.000Z",
      event_type: "down",
    });
    const mine = event({
      occurred_at: "2026-08-28T08:00:00.000Z",
      event_type: "idle",
    });
    const view = buildFloorView({
      machines: [machine],
      events: [other, mine],
      eventsAvailable: true,
      windowStart: dayStart,
      windowEnd: noon,
    });
    expect(view.rows[0].state).toBe("IDLE");
  });
});

describe("parseFloorWindow", () => {
  it("rejects an inverted or oversized window", () => {
    expect(() =>
      parseFloorWindow("2026-08-28T12:00:00.000Z", "2026-08-28T00:00:00.000Z"),
    ).toThrow(/end must be after start/);
    expect(() =>
      parseFloorWindow("2026-08-01T00:00:00.000Z", "2026-08-10T00:00:00.000Z"),
    ).toThrow(/48 hours/);
  });
});

describe("formatFloorHours", () => {
  it("renders two decimal hours", () => {
    expect(formatFloorHours(1.5)).toBe("1.50 h");
  });
});
