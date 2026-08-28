/**
 * Push-based ingestion for the MTConnect bridge agent -- a real, plain
 * HTTP+JSON endpoint an external process can call, deliberately NOT a
 * TanStack Start server function. Server functions use TanStack's own
 * internal wire serialization (seroval), not plain JSON -- confirmed
 * directly that an external client posting plain JSON to a
 * `/_serverFn/{id}` URL fails with a serialization error before ever
 * reaching handler code. A bridge agent running on a customer's network
 * is about as external a caller as exists in this app, so this needs to
 * be a genuinely plain HTTP handler using the standard Fetch API
 * Request/Response, wired in ahead of TanStack's own routing in
 * src/server.ts.
 *
 * Authenticated with a per-machine API key (Authorization: Bearer ...),
 * not a browser session -- there's no logged-in user on the other end of
 * this request. Runs under withAdmin (bypasses RLS, no session/current_user_id
 * exists here) with an explicit, manual authorization check taking RLS's
 * place: the caller must present the exact key whose SHA-256 hash matches
 * what's stored for the specific machine ID in the URL. Same pattern
 * already used elsewhere in this codebase for withAdmin call sites
 * (signup, session management) -- explicit checks in the handler, not an
 * assumption that reaching this code at all implies authorization.
 */

import { createHash, randomBytes } from "node:crypto";
import { withAdmin } from "@/lib/db.server";
import type { MTConnectCurrentReading } from "@/lib/mtconnect-client.server";

const MAX_ATTRIBUTABLE_MINUTES = 24 * 60;

function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

/** Generates a new bridge API key for a machine. Returns the plaintext once -- never stored, never retrievable again. */
export async function generateBridgeApiKey(machineId: string): Promise<string> {
  const plaintext = randomBytes(32).toString("base64url");
  const hash = hashApiKey(plaintext);
  const hint = plaintext.slice(-4);
  await withAdmin((client) =>
    client.query(
      `UPDATE public.shop_machines
          SET bridge_api_key_hash = $2, bridge_api_key_hint = $3, bridge_api_key_created_at = now()
        WHERE id = $1`,
      [machineId, hash, hint],
    ),
  );
  return plaintext;
}

interface IngestBody {
  deviceName?: unknown;
  sequence?: unknown;
  timestamp?: unknown;
  state?: unknown;
  rawExecution?: unknown;
  partCount?: unknown;
  partNumber?: unknown;
}

function parseReading(body: IngestBody): MTConnectCurrentReading {
  if (
    typeof body.timestamp !== "string" ||
    (body.state !== "active" && body.state !== "idle" && body.state !== "down")
  ) {
    throw new Error("Request body isn't a valid MTConnect reading.");
  }
  return {
    deviceName:
      typeof body.deviceName === "string" ? body.deviceName : "unknown",
    sequence: typeof body.sequence === "number" ? body.sequence : null,
    timestamp: body.timestamp,
    state: body.state,
    rawExecution:
      typeof body.rawExecution === "string" ? body.rawExecution : null,
    partCount: typeof body.partCount === "number" ? body.partCount : null,
    partNumber: typeof body.partNumber === "string" ? body.partNumber : null,
  };
}

/**
 * Applies one pushed reading: computes the delta since the last reading
 * for this machine, writes a shop_machine_run_events row (source='live')
 * once there's a real prior reading to delta against, and flips
 * connection_status to 'live' -- the only place that ever happens,
 * exactly like the removed pull-based sync function, just triggered by
 * an inbound push instead of an outbound fetch.
 */
export async function applyMtconnectReading(
  machineId: string,
  reading: MTConnectCurrentReading,
): Promise<{
  recordedRunEvent: boolean;
  attributedMinutes: number;
  cyclesDelta: number;
}> {
  const machine = await withAdmin(async (client) => {
    const { rows } = await client.query<{
      organization_id: string;
      facility_id: string;
      current_part_number: string | null;
    }>(
      `SELECT organization_id, facility_id, current_part_number FROM public.shop_machines WHERE id = $1`,
      [machineId],
    );
    return rows[0] ?? null;
  });
  if (!machine) throw new Error("Machine not found.");

  const lastState = await withAdmin(async (client) => {
    const { rows } = await client.query<{
      last_polled_at: string | null;
      last_part_count: string | null;
      last_part_number: string | null;
    }>(
      `SELECT last_polled_at, last_part_count, last_part_number
         FROM public.shop_machine_live_state WHERE machine_id = $1`,
      [machineId],
    );
    return rows[0] ?? null;
  });

  const now = new Date(reading.timestamp);
  const lastPolledAt = lastState?.last_polled_at
    ? new Date(lastState.last_polled_at)
    : null;
  const elapsedMinutes = lastPolledAt
    ? Math.max(0, (now.getTime() - lastPolledAt.getTime()) / 60_000)
    : 0;
  const attributedMinutes = Math.min(elapsedMinutes, MAX_ATTRIBUTABLE_MINUTES);

  const lastPartCount =
    lastState?.last_part_count != null
      ? Number(lastState.last_part_count)
      : null;
  const cyclesDelta =
    lastPartCount != null && reading.partCount != null
      ? Math.max(0, reading.partCount - lastPartCount)
      : 0;

  const partNumber =
    reading.partNumber ||
    machine.current_part_number ||
    lastState?.last_part_number ||
    "unspecified";

  const recordedRunEvent = Boolean(lastState?.last_polled_at);
  if (recordedRunEvent) {
    await withAdmin((client) =>
      client.query(
        `INSERT INTO public.shop_machine_run_events
           (machine_id, organization_id, facility_id, occurred_at, part_number,
            cycles, runtime_minutes, idle_minutes, downtime_minutes, source)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'live')`,
        [
          machineId,
          machine.organization_id,
          machine.facility_id,
          reading.timestamp,
          partNumber,
          cyclesDelta,
          reading.state === "active" ? attributedMinutes : 0,
          reading.state === "idle" ? attributedMinutes : 0,
          reading.state === "down" ? attributedMinutes : 0,
        ],
      ),
    );
  }

  await withAdmin(async (client) => {
    await client.query(
      `INSERT INTO public.shop_machine_live_state
         (machine_id, last_polled_at, last_sequence, last_execution, last_part_count, last_part_number, last_error)
       VALUES ($1, $2, $3, $4, $5, $6, NULL)
       ON CONFLICT (machine_id) DO UPDATE
         SET last_polled_at = $2, last_sequence = $3, last_execution = $4,
             last_part_count = $5, last_part_number = $6, last_error = NULL`,
      [
        machineId,
        reading.timestamp,
        reading.sequence,
        reading.rawExecution,
        reading.partCount,
        partNumber,
      ],
    );
    await client.query(
      `UPDATE public.shop_machines SET connection_status = 'live' WHERE id = $1`,
      [machineId],
    );
  });

  return {
    recordedRunEvent,
    attributedMinutes: recordedRunEvent ? attributedMinutes : 0,
    cyclesDelta,
  };
}

const INGEST_PATH_RE = /^\/api\/machines\/([0-9a-f-]{36})\/ingest$/i;

/**
 * Matches and handles a bridge ingestion request. Returns null for any
 * request that doesn't match this route at all, so src/server.ts can
 * fall through to the normal TanStack Start handler for everything else.
 */
export async function tryHandleMachineIngest(
  request: Request,
): Promise<Response | null> {
  const url = new URL(request.url);
  const match = INGEST_PATH_RE.exec(url.pathname);
  if (!match) return null;
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed." }, { status: 405 });
  }

  const machineId = match[1];
  const authHeader = request.headers.get("authorization") ?? "";
  const providedKey = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : "";
  if (!providedKey) {
    return Response.json({ error: "Missing bearer token." }, { status: 401 });
  }

  const stored = await withAdmin(async (client) => {
    const { rows } = await client.query<{ bridge_api_key_hash: string | null }>(
      `SELECT bridge_api_key_hash FROM public.shop_machines WHERE id = $1`,
      [machineId],
    );
    return rows[0]?.bridge_api_key_hash ?? null;
  });
  if (!stored || stored !== hashApiKey(providedKey)) {
    return Response.json(
      { error: "Invalid machine id or API key." },
      { status: 401 },
    );
  }

  let body: IngestBody;
  try {
    body = (await request.json()) as IngestBody;
  } catch {
    return Response.json(
      { error: "Request body must be JSON." },
      { status: 400 },
    );
  }

  let reading: MTConnectCurrentReading;
  try {
    reading = parseReading(body);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Invalid reading." },
      { status: 400 },
    );
  }

  try {
    const result = await applyMtconnectReading(machineId, reading);
    return Response.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await withAdmin((client) =>
      client.query(
        `INSERT INTO public.shop_machine_live_state (machine_id, last_polled_at, last_error)
         VALUES ($1, now(), $2)
         ON CONFLICT (machine_id) DO UPDATE SET last_polled_at = now(), last_error = $2`,
        [machineId, message],
      ),
    );
    return Response.json({ error: message }, { status: 500 });
  }
}
