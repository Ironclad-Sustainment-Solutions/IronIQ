import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { DEFAULT_IDLE_GAP_MINUTES } from "./machine-event";
import {
  createMemoryFacilityAuthStore,
  createMemoryMachineEventStore,
  handleMachineEventsRequest,
  type StoredMachineEvent,
} from "./machine-event-ingest.server";

/**
 * Grede V1 capture-coverage: POST iss.machine_event.v1 through the same
 * handler and per-facility edge-key auth as POST
 * /api/ironiq/v1/machine-events, then read stored rows back. Asserts
 * Matt's six plus alarm/heartbeat/capture_path/plant_id/quality/
 * control_mode are persisted with the posted values.
 */

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const EDGE_KEY = "test-facility-edge-key-not-for-production";

const demoMachine = {
  id: "11111111-1111-1111-1111-111111111111",
  organization_id: "22222222-2222-2222-2222-222222222222",
  facility_id: "33333333-3333-3333-3333-333333333333",
  asset_id: "MC-UMC750-01",
};

function facilityAuth() {
  return createMemoryFacilityAuthStore([
    {
      key: EDGE_KEY,
      facilityId: demoMachine.facility_id,
      organizationId: demoMachine.organization_id,
    },
  ]);
}

const shared = {
  schema: "iss.machine_event.v1",
  plant_id: "grede-biscoe",
  source_system: "ironiq-edge",
  machine_id: "MC-UMC750-01",
  machine_serial: "3182334",
  controller_make: "Haas",
  controller_model: "UMC-750",
  capture_path: "mtconnect",
  program_name: "O5123",
  quality: { source_ok: true, notes: null as string | null },
};

const stateChange = {
  ...shared,
  event_type: "state_change",
  ts_utc: "2026-08-27T14:32:01Z",
  state: "RUNNING",
  prev_state: "IDLE",
  part_id: null,
  job_id: null,
  cycle_seq: 41,
  cycle_time_s: null,
  runtime_cutting_s: null,
  spindle_on_s: null,
  idle_since_prev_cycle_s: 120,
  gap_class: null,
  alarm_code: null,
  alarm_active: false,
  control_mode: "AUTO",
};

const cycleEnd = {
  ...shared,
  event_type: "cycle_end",
  ts_utc: "2026-08-27T14:40:12Z",
  state: "IDLE",
  prev_state: "RUNNING",
  part_id: "HUB-4410",
  job_id: "JOB-77",
  cycle_seq: 41,
  cycle_time_s: 187.4,
  runtime_cutting_s: 142.1,
  spindle_on_s: 150,
  // 16 minutes — IronIQ, not the CNC, sets SETUP_CANDIDATE.
  idle_since_prev_cycle_s: 16 * 60,
  gap_class: null,
  alarm_code: null,
  alarm_active: false,
};

const heartbeat = {
  ...shared,
  event_type: "heartbeat",
  ts_utc: "2026-08-27T14:41:12Z",
  state: "IDLE",
  prev_state: "IDLE",
  part_id: "HUB-4410",
  job_id: "JOB-77",
  cycle_seq: 41,
  cycle_time_s: null,
  runtime_cutting_s: null,
  spindle_on_s: null,
  idle_since_prev_cycle_s: 16 * 60,
  gap_class: null,
  alarm_code: null,
  alarm_active: false,
};

const alarm = {
  ...shared,
  event_type: "alarm",
  ts_utc: "2026-08-27T14:42:00Z",
  state: "DOWN",
  prev_state: "IDLE",
  part_id: "HUB-4410",
  job_id: "JOB-77",
  cycle_seq: 41,
  cycle_time_s: null,
  runtime_cutting_s: null,
  spindle_on_s: null,
  idle_since_prev_cycle_s: null,
  gap_class: "ALARM",
  alarm_code: "102",
  alarm_active: true,
};

function post(body: unknown, authorization?: string): Request {
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (authorization) headers.authorization = authorization;
  return new Request("http://ironiq.test/api/ironiq/v1/machine-events", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

async function postAuthorized(
  store: ReturnType<typeof createMemoryMachineEventStore>,
  body: unknown,
) {
  const response = await handleMachineEventsRequest(
    post(body, `Bearer ${EDGE_KEY}`),
    {
      store,
      facilityAuth: facilityAuth(),
      idleGapMinutes: DEFAULT_IDLE_GAP_MINUTES,
    },
  );
  return { response, json: await response.json() };
}

function sameInstant(stored: string, posted: string): boolean {
  return new Date(stored).getTime() === new Date(posted).getTime();
}

function byType(
  rows: StoredMachineEvent[],
  eventType: string,
): StoredMachineEvent {
  const match = rows.filter((row) => row.event_type === eventType);
  expect(match, `expected one stored ${eventType}`).toHaveLength(1);
  return match[0];
}

function expectIdentity(row: StoredMachineEvent) {
  expect(row.machine_id).toBe("MC-UMC750-01");
  expect(row.machine_serial).toBe("3182334");
  expect(row.controller_make).toBe("Haas");
  expect(row.controller_model).toBe("UMC-750");
  expect(row.plant_id).toBe("grede-biscoe");
  expect(row.source_system).toBe("ironiq-edge");
  expect(row.capture_path).toBe("mtconnect");
  expect(row.event_schema).toBe("iss.machine_event.v1");
  expect(row.quality?.source_ok).toBe(true);
  expect(row.shop_machine_id).toBe(demoMachine.id);
  expect(row.organization_id).toBe(demoMachine.organization_id);
  expect(row.facility_id).toBe(demoMachine.facility_id);
}

describe("Grede V1 capture coverage", () => {
  it("persists Matt's six plus alarm, heartbeat, capture_path, plant, quality", async () => {
    const store = createMemoryMachineEventStore([demoMachine]);

    const first = await postAuthorized(store, stateChange);
    expect(first.response.status).toBe(202);
    expect(first.json).toEqual({ accepted: 1, duplicates: 0 });

    const cycle = await postAuthorized(store, cycleEnd);
    expect(cycle.response.status).toBe(202);
    expect(cycle.json).toEqual({ accepted: 1, duplicates: 0 });

    const beat = await postAuthorized(store, heartbeat);
    expect(beat.response.status).toBe(202);
    expect(beat.json).toEqual({ accepted: 1, duplicates: 0 });

    const alarmRes = await postAuthorized(store, alarm);
    expect(alarmRes.response.status).toBe(202);
    expect(alarmRes.json).toEqual({ accepted: 1, duplicates: 0 });

    const duplicate = await postAuthorized(store, cycleEnd);
    expect(duplicate.response.status).toBe(202);
    expect(duplicate.json).toEqual({ accepted: 0, duplicates: 1 });

    const unauthorized = await handleMachineEventsRequest(post(cycleEnd), {
      store,
      facilityAuth: facilityAuth(),
    });
    expect(unauthorized.status).not.toBe(202);
    expect(unauthorized.status).toBe(401);

    const invalid = await postAuthorized(store, {
      ...cycleEnd,
      event_type: "not-a-type",
    });
    expect(invalid.response.status).toBe(400);
    expect(invalid.json.error).toBe("invalid payload");

    const rows = await store.listByMachineId("MC-UMC750-01");
    expect(rows).toHaveLength(4);

    const storedState = byType(rows, "state_change");
    expectIdentity(storedState);
    expect(sameInstant(storedState.ts_utc, stateChange.ts_utc)).toBe(true);
    expect(storedState.state).toBe("RUNNING");
    expect(storedState.prev_state).toBe("IDLE");
    expect(storedState.program_name).toBe("O5123");
    expect(storedState.part_id).toBeNull();
    expect(storedState.cycle_seq).toBe(41);
    expect(storedState.alarm_code).toBeNull();
    expect(storedState.alarm_active).toBe(false);
    expect(storedState.control_mode).toBe("AUTO");

    const storedCycle = byType(rows, "cycle_end");
    expectIdentity(storedCycle);
    expect(sameInstant(storedCycle.ts_utc, cycleEnd.ts_utc)).toBe(true);
    expect(storedCycle.cycle_seq).toBe(41);
    expect(storedCycle.runtime_cutting_s).toBe(142.1);
    expect(storedCycle.spindle_on_s).toBe(150);
    expect(storedCycle.state).toBe("IDLE");
    expect(storedCycle.prev_state).toBe("RUNNING");
    expect(storedCycle.program_name).toBe("O5123");
    expect(storedCycle.part_id).toBe("HUB-4410");
    expect(storedCycle.cycle_time_s).toBe(187.4);
    expect(storedCycle.idle_since_prev_cycle_s).toBe(16 * 60);
    expect(storedCycle.gap_class).toBe("SETUP_CANDIDATE");
    expect(storedCycle.job_id).toBe("JOB-77");
    expect(storedCycle.control_mode).toBeNull();

    const storedHeartbeat = byType(rows, "heartbeat");
    expectIdentity(storedHeartbeat);
    expect(sameInstant(storedHeartbeat.ts_utc, heartbeat.ts_utc)).toBe(true);
    expect(storedHeartbeat.event_type).toBe("heartbeat");
    expect(storedHeartbeat.state).toBe("IDLE");
    expect(storedHeartbeat.program_name).toBe("O5123");
    expect(storedHeartbeat.control_mode).toBeNull();

    const storedAlarm = byType(rows, "alarm");
    expectIdentity(storedAlarm);
    expect(sameInstant(storedAlarm.ts_utc, alarm.ts_utc)).toBe(true);
    expect(storedAlarm.event_type).toBe("alarm");
    expect(storedAlarm.state).toBe("DOWN");
    expect(storedAlarm.prev_state).toBe("IDLE");
    expect(storedAlarm.alarm_code).toBe("102");
    expect(storedAlarm.alarm_active).toBe(true);
    expect(storedAlarm.gap_class).toBe("ALARM");
    expect(storedAlarm.control_mode).toBeNull();
  });

  it("stores omitted or null control_mode as null and rejects invalid values", async () => {
    const store = createMemoryMachineEventStore([demoMachine]);

    const omitted = await postAuthorized(store, cycleEnd);
    expect(omitted.response.status).toBe(202);
    const withNull = await postAuthorized(store, {
      ...heartbeat,
      control_mode: null,
    });
    expect(withNull.response.status).toBe(202);
    const invalid = await postAuthorized(store, {
      ...stateChange,
      control_mode: "MEM",
    });
    expect(invalid.response.status).toBe(400);
    expect(invalid.json.error).toBe("invalid payload");

    const rows = await store.listByMachineId("MC-UMC750-01");
    expect(byType(rows, "cycle_end").control_mode).toBeNull();
    expect(byType(rows, "heartbeat").control_mode).toBeNull();
    expect(
      rows.filter((row) => row.event_type === "state_change"),
    ).toHaveLength(0);
  });

  it("includes control_mode AUTO | MDI | JOG on the event schema", () => {
    const schema = readFileSync(
      join(root, "db/schema_additions_machine_events.sql"),
      "utf8",
    );
    expect(schema).toMatch(/shop_machine_event_control_mode/);
    expect(schema).toMatch(/'AUTO', 'MDI', 'JOG'/);
  });
});
