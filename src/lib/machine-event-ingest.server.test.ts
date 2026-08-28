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
  createMemoryMachineEventStore,
  edgeSecretMatches,
  handleMachineEventsRequest,
} from "./machine-event-ingest.server";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

const sample = JSON.parse(
  readFileSync(join(root, "samples/iss-machine-event-v1.json"), "utf8"),
) as Record<string, unknown>;

const EDGE_SECRET = "test-edge-secret-not-for-production";

const demoMachine = {
  id: "11111111-1111-1111-1111-111111111111",
  organization_id: "22222222-2222-2222-2222-222222222222",
  facility_id: "33333333-3333-3333-3333-333333333333",
  asset_id: "MC-UMC750-01",
};

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
  return postRequest(body, { authorization: `Bearer ${EDGE_SECRET}` });
}

async function ingest(body: unknown, extra?: RequestInit) {
  const store = createMemoryMachineEventStore([demoMachine]);
  const request =
    extra == null
      ? authorizedPost(body)
      : new Request("http://ironiq.test/api/ironiq/v1/machine-events", extra);
  const response = await handleMachineEventsRequest(request, {
    store,
    edgeSecret: EDGE_SECRET,
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
  it("compares secrets timing-safe and ignores query params", () => {
    expect(edgeSecretMatches(EDGE_SECRET, EDGE_SECRET)).toBe(true);
    expect(edgeSecretMatches("nope", EDGE_SECRET)).toBe(false);
    expect(edgeSecretMatches(null, EDGE_SECRET)).toBe(false);
    expect(edgeSecretMatches(EDGE_SECRET, "")).toBe(false);
    const request = new Request(
      `http://ironiq.test/api/ironiq/v1/machine-events?secret=${EDGE_SECRET}`,
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
      edgeSecret: EDGE_SECRET,
    });
    const second = await handleMachineEventsRequest(authorizedPost(sample), {
      store,
      edgeSecret: EDGE_SECRET,
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

  it("does not return 202 when unauthorized", async () => {
    const store = createMemoryMachineEventStore([demoMachine]);
    const missing = await handleMachineEventsRequest(postRequest(sample), {
      store,
      edgeSecret: EDGE_SECRET,
    });
    const wrong = await handleMachineEventsRequest(
      postRequest(sample, { authorization: "Bearer wrong-secret" }),
      { store, edgeSecret: EDGE_SECRET },
    );
    const queryOnly = await handleMachineEventsRequest(
      new Request(
        `http://ironiq.test/api/ironiq/v1/machine-events?token=${EDGE_SECRET}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(sample),
        },
      ),
      { store, edgeSecret: EDGE_SECRET },
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
});
