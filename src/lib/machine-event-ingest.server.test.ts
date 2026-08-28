import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_IDLE_GAP_MINUTES,
  parseMachineEventPayload,
  resolveGapClass,
} from "./machine-event";
import {
  bearerTokenFromRequest,
  createMemoryFacilityAuthStore,
  createMemoryMachineEventStore,
  handleMachineEventsRequest,
} from "./machine-event-ingest.server";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

const sample = JSON.parse(
  readFileSync(join(root, "samples/iss-machine-event-v1.json"), "utf8"),
) as Record<string, unknown>;

const EDGE_KEY = "test-facility-edge-key-not-for-production";
const FACILITY_ID = "33333333-3333-3333-3333-333333333333";
const ORG_ID = "22222222-2222-2222-2222-222222222222";
const OTHER_FACILITY_ID = "44444444-4444-4444-4444-444444444444";

const demoMachine = {
  id: "11111111-1111-1111-1111-111111111111",
  organization_id: ORG_ID,
  facility_id: FACILITY_ID,
  asset_id: "MC-UMC750-01",
};

function facilityAuth() {
  return createMemoryFacilityAuthStore([
    { key: EDGE_KEY, facilityId: FACILITY_ID, organizationId: ORG_ID },
  ]);
}

function postRequest(
  body: unknown,
  headers: Record<string, string> = {},
): Request {
  return new Request("http://ironiq.test/api/ironiq/v1/machine-events", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

function authorizedPost(body: unknown): Request {
  return postRequest(body, { authorization: `Bearer ${EDGE_KEY}` });
}

async function ingest(body: unknown, extra?: RequestInit) {
  const store = createMemoryMachineEventStore([demoMachine]);
  const request =
    extra == null
      ? authorizedPost(body)
      : new Request("http://ironiq.test/api/ironiq/v1/machine-events", extra);
  const response = await handleMachineEventsRequest(request, {
    store,
    facilityAuth: facilityAuth(),
    idleGapMinutes: DEFAULT_IDLE_GAP_MINUTES,
  });
  return { response, store, json: await response.json() };
}

describe("parseMachineEventPayload", () => {
  it("accepts the spec state_change sample as a single object", () => {
    const parsed = parseMachineEventPayload(sample);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.events).toHaveLength(1);
    expect(parsed.events[0].plant_id).toBe("grede-biscoe");
    expect(parsed.events[0].machine_id).toBe("MC-UMC750-01");
    expect(parsed.events[0].program_name).toBe("O5123");
    expect(parsed.events[0].state).toBe("RUNNING");
  });

  it("accepts an events envelope up to 100", () => {
    const parsed = parseMachineEventPayload({ events: [sample, sample] });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.events).toHaveLength(2);
  });

  it("rejects a bare array and an empty envelope", () => {
    expect(parseMachineEventPayload([sample]).ok).toBe(false);
    expect(parseMachineEventPayload({ events: [] }).ok).toBe(false);
  });
});

describe("resolveGapClass", () => {
  it("sets SETUP_CANDIDATE in IronIQ when idle gap exceeds N minutes", () => {
    expect(
      resolveGapClass(
        { idle_since_prev_cycle_s: 15 * 60 + 1, gap_class: null },
        15,
      ),
    ).toBe("SETUP_CANDIDATE");
    expect(
      resolveGapClass(
        { idle_since_prev_cycle_s: 14 * 60, gap_class: "SETUP_CANDIDATE" },
        15,
      ),
    ).toBeNull();
  });

  it("keeps ALARM / FIRST_PIECE_CANDIDATE from the payload", () => {
    expect(
      resolveGapClass(
        { idle_since_prev_cycle_s: 2000, gap_class: "ALARM" },
        15,
      ),
    ).toBe("ALARM");
  });
});

describe("edge ingest auth", () => {
  it("resolves a facility from its own key, and only its own key", async () => {
    const auth = facilityAuth();
    expect(await auth.resolveFacilityByEdgeKey(EDGE_KEY)).toEqual({
      facilityId: FACILITY_ID,
      organizationId: ORG_ID,
    });
    expect(await auth.resolveFacilityByEdgeKey("wrong-key")).toBeNull();
  });

  it("never reads a credential from query params, only the Authorization header", () => {
    const request = new Request(
      `http://ironiq.test/api/ironiq/v1/machine-events?secret=${EDGE_KEY}`,
      { method: "POST" },
    );
    expect(bearerTokenFromRequest(request)).toBeNull();
  });
});

describe("POST /api/ironiq/v1/machine-events", () => {
  it("stores the spec state_change packet and returns 202", async () => {
    const { response, json, store } = await ingest(sample);
    expect(response.status).toBe(202);
    expect(json).toEqual({ accepted: 1, duplicates: 0 });
    const rows = await store.listByMachineId("MC-UMC750-01");
    expect(rows).toHaveLength(1);
    expect(rows[0].plant_id).toBe("grede-biscoe");
    expect(rows[0].program_name).toBe("O5123");
    expect(rows[0].state).toBe("RUNNING");
    expect(rows[0].event_schema).toBe("iss.machine_event.v1");
    expect(rows[0].part_id).toBeNull();
    expect(rows[0].organization_id).toBe(demoMachine.organization_id);
    expect(rows[0].facility_id).toBe(demoMachine.facility_id);
    expect(rows[0].shop_machine_id).toBe(demoMachine.id);
  });

  it("treats a second identical POST as a duplicate, not an error", async () => {
    const store = createMemoryMachineEventStore([demoMachine]);
    const first = await handleMachineEventsRequest(authorizedPost(sample), {
      store,
      facilityAuth: facilityAuth(),
    });
    const second = await handleMachineEventsRequest(authorizedPost(sample), {
      store,
      facilityAuth: facilityAuth(),
    });
    expect(first.status).toBe(202);
    expect(await first.json()).toEqual({ accepted: 1, duplicates: 0 });
    expect(second.status).toBe(202);
    expect(await second.json()).toEqual({ accepted: 0, duplicates: 1 });
    expect(await store.listByMachineId("MC-UMC750-01")).toHaveLength(1);
  });

  it("returns 400 for an invalid payload", async () => {
    const { response, json } = await ingest({
      ...sample,
      event_type: "not-a-type",
    });
    expect(response.status).toBe(400);
    expect(json.error).toBe("invalid payload");
  });

  it("returns 400 when machine_id is not a known shop machine", async () => {
    const { response, json, store } = await ingest({
      ...sample,
      machine_id: "NO-SUCH-ASSET",
    });
    expect(response.status).toBe(400);
    expect(json.error).toBe("invalid payload");
    expect(await store.listByMachineId("NO-SUCH-ASSET")).toHaveLength(0);
  });

  it("returns 400 (not 202, not a data leak) when the asset_id belongs to a DIFFERENT facility than the authenticated key", async () => {
    // The core security property this whole redesign exists for: a
    // facility's edge key must never be able to touch another
    // facility's machine, even one that genuinely exists on the
    // platform. Confirmed indistinguishable from "doesn't exist" --
    // the error message doesn't reveal that MC-UMC750-01 exists
    // somewhere else.
    const store = createMemoryMachineEventStore([
      { ...demoMachine, facility_id: OTHER_FACILITY_ID },
    ]);
    const response = await handleMachineEventsRequest(authorizedPost(sample), {
      store,
      facilityAuth: facilityAuth(),
    });
    const json = await response.json();
    expect(response.status).toBe(400);
    expect(json.details[0]).toBe("machine_id: unknown asset_id MC-UMC750-01");
    expect(await store.listByMachineId("MC-UMC750-01")).toHaveLength(0);
  });

  it("does not return 202 when unauthorized", async () => {
    const store = createMemoryMachineEventStore([demoMachine]);
    const missing = await handleMachineEventsRequest(postRequest(sample), {
      store,
      facilityAuth: facilityAuth(),
    });
    const wrong = await handleMachineEventsRequest(
      postRequest(sample, { authorization: "Bearer wrong-key" }),
      { store, facilityAuth: facilityAuth() },
    );
    const queryOnly = await handleMachineEventsRequest(
      new Request(
        `http://ironiq.test/api/ironiq/v1/machine-events?token=${EDGE_KEY}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(sample),
        },
      ),
      { store, facilityAuth: facilityAuth() },
    );
    expect(missing.status).not.toBe(202);
    expect(wrong.status).not.toBe(202);
    expect(queryOnly.status).not.toBe(202);
    expect(missing.status).toBe(401);
    expect(wrong.status).toBe(401);
    expect(queryOnly.status).toBe(401);
    expect(await store.listByMachineId("MC-UMC750-01")).toHaveLength(0);
  });

  it("accepts a heartbeat without generating one", async () => {
    const { response, json, store } = await ingest({
      ...sample,
      event_type: "heartbeat",
      ts_utc: "2026-08-27T14:33:01Z",
      cycle_seq: null,
    });
    expect(response.status).toBe(202);
    expect(json).toEqual({ accepted: 1, duplicates: 0 });
    const rows = await store.listByMachineId("MC-UMC750-01");
    expect(rows[0].event_type).toBe("heartbeat");
  });

  it("is a real HTTP route, not a CSRF-exempt serverFn", () => {
    const route = readFileSync(
      join(root, "src/routes/api/ironiq/v1/machine-events.ts"),
      "utf8",
    );
    const start = readFileSync(join(root, "src/start.ts"), "utf8");
    expect(route).toContain('createFileRoute("/api/ironiq/v1/machine-events")');
    expect(route).toContain("POST:");
    expect(route).not.toContain("createServerFn");
    expect(start).toContain('ctx.handlerType === "serverFn"');
  });

  it("authenticates before parsing the body — garbage JSON with a bad key is 401, not 400", async () => {
    const store = createMemoryMachineEventStore([demoMachine]);
    const missing = await handleMachineEventsRequest(
      new Request("http://ironiq.test/api/ironiq/v1/machine-events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "not-json{{{",
      }),
      { store, facilityAuth: facilityAuth() },
    );
    const wrong = await handleMachineEventsRequest(
      new Request("http://ironiq.test/api/ironiq/v1/machine-events", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer wrong-key",
        },
        body: "not-json{{{",
      }),
      { store, facilityAuth: facilityAuth() },
    );
    expect(missing.status).toBe(401);
    expect(wrong.status).toBe(401);
    expect(await missing.json()).toEqual({ error: "Unauthorized" });
    expect(await wrong.json()).toEqual({ error: "Unauthorized" });
  });

  it("stores an arbitrary plant_id as posted text, not a required grede plant", async () => {
    const { response, json, store } = await ingest({
      ...sample,
      plant_id: "north-shop-3",
      ts_utc: "2026-08-27T15:00:00Z",
    });
    expect(response.status).toBe(202);
    expect(json).toEqual({ accepted: 1, duplicates: 0 });
    const rows = await store.listByMachineId("MC-UMC750-01");
    expect(rows[0].plant_id).toBe("north-shop-3");
    expect(rows[0].organization_id).toBe(ORG_ID);
    expect(rows[0].facility_id).toBe(FACILITY_ID);
  });

  it("lets two organizations ingest the same asset_id independently", async () => {
    const orgB = "55555555-5555-5555-5555-555555555555";
    const facilityB = "66666666-6666-6666-6666-666666666666";
    const keyB = "org-b-facility-edge-key";
    const machineB = {
      id: "77777777-7777-7777-7777-777777777777",
      organization_id: orgB,
      facility_id: facilityB,
      asset_id: "MC-UMC750-01",
    };
    const store = createMemoryMachineEventStore([demoMachine, machineB]);
    const auth = createMemoryFacilityAuthStore([
      { key: EDGE_KEY, facilityId: FACILITY_ID, organizationId: ORG_ID },
      { key: keyB, facilityId: facilityB, organizationId: orgB },
    ]);
    const body = { ...sample, ts_utc: "2026-08-27T16:00:00Z" };
    const a = await handleMachineEventsRequest(authorizedPost(body), {
      store,
      facilityAuth: auth,
    });
    const b = await handleMachineEventsRequest(
      postRequest(body, { authorization: `Bearer ${keyB}` }),
      { store, facilityAuth: auth },
    );
    expect(a.status).toBe(202);
    expect(b.status).toBe(202);
    expect(await a.json()).toEqual({ accepted: 1, duplicates: 0 });
    expect(await b.json()).toEqual({ accepted: 1, duplicates: 0 });
    const rows = await store.listByMachineId("MC-UMC750-01");
    expect(rows).toHaveLength(2);
    expect(new Set(rows.map((row) => row.organization_id))).toEqual(
      new Set([ORG_ID, orgB]),
    );
    expect(new Set(rows.map((row) => row.facility_id)).size).toBe(2);
  });

  it("returns 400 (doesn't exist) when Org A's key posts Org B's machine", async () => {
    const orgB = "55555555-5555-5555-5555-555555555555";
    const facilityB = "66666666-6666-6666-6666-666666666666";
    const store = createMemoryMachineEventStore([
      {
        ...demoMachine,
        organization_id: orgB,
        facility_id: facilityB,
      },
    ]);
    const response = await handleMachineEventsRequest(authorizedPost(sample), {
      store,
      facilityAuth: facilityAuth(),
    });
    const json = await response.json();
    expect(response.status).toBe(400);
    expect(json.details[0]).toBe("machine_id: unknown asset_id MC-UMC750-01");
    expect(json.details[0]).not.toMatch(/org|facility|exist/i);
    expect(await store.listByMachineId("MC-UMC750-01")).toHaveLength(0);
  });
});
