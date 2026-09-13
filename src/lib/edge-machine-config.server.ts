/**
 * Lets the Edge agent fetch its facility's current machine list directly
 * from IronIQ, authenticated the same way machine-events ingestion
 * already is (a per-facility bearer token, never a global secret) --
 * so editing a machine's protocol/connection details in the app's own
 * form is immediately what the Edge agent uses next time it starts or
 * refreshes, with no local config file to hand-edit or regenerate ever
 * again after the very first bootstrap (which only ever needs
 * ironiq_url + facility_key -- everything else lives here now).
 *
 * Deliberately reuses machine-event-ingest.server.ts's own
 * bearerTokenFromRequest/createPgFacilityAuthStore rather than a second,
 * parallel auth implementation -- one real, tested way to authenticate
 * an edge box, not two that could quietly drift apart.
 */

import { withAdmin } from "@/lib/db.server";
import {
  bearerTokenFromRequest,
  createPgFacilityAuthStore,
} from "@/lib/machine-event-ingest.server";

export interface EdgeConfigMachine {
  asset_id: string;
  protocol: "mtconnect" | "focas";
  mtconnect_url?: string;
  focas_host?: string;
  focas_port?: number;
  controller_make: string;
}

const CONTROLLER_MAKE_LABELS: Record<string, string> = {
  fanuc: "Fanuc",
  haas: "Haas",
  mazak: "Mazak",
  siemens: "Siemens",
  other: "Other",
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/**
 * Maps a real shop_machines row to what the Edge agent actually needs.
 * Only machines with a protocol the agent knows how to speak
 * (mtconnect, fanuc_focas) are included, and only once they have the
 * connection details that protocol actually needs -- a machine set to
 * "fanuc_focas" but with no focas_host entered yet isn't included until
 * someone fills that in via the machine's own edit form, rather than
 * shipping the agent a config entry it can't actually use.
 */
export function mapMachineRow(row: {
  asset_id: string;
  control: string;
  protocol: string;
  mtconnect_agent_url: string | null;
  focas_host: string | null;
  focas_port: number | null;
}): EdgeConfigMachine | null {
  const controllerMake = CONTROLLER_MAKE_LABELS[row.control] ?? "Other";
  if (row.protocol === "mtconnect" && row.mtconnect_agent_url) {
    return {
      asset_id: row.asset_id,
      protocol: "mtconnect",
      mtconnect_url: row.mtconnect_agent_url,
      controller_make: controllerMake,
    };
  }
  if (row.protocol === "fanuc_focas" && row.focas_host && row.focas_port) {
    return {
      asset_id: row.asset_id,
      protocol: "focas",
      focas_host: row.focas_host,
      focas_port: row.focas_port,
      controller_make: controllerMake,
    };
  }
  return null;
}

export async function handleEdgeConfigRequest(
  request: Request,
): Promise<Response> {
  if (request.method !== "GET") {
    return jsonResponse(405, { error: "method not allowed" });
  }

  const provided = bearerTokenFromRequest(request);
  if (!provided) {
    return jsonResponse(401, { error: "Unauthorized" });
  }

  try {
    return await withAdmin(async (client) => {
      const auth = createPgFacilityAuthStore(client);
      const facility = await auth.resolveFacilityByEdgeKey(provided);
      if (!facility) {
        return jsonResponse(401, { error: "Unauthorized" });
      }

      const { rows } = await client.query<{
        asset_id: string;
        control: string;
        protocol: string;
        mtconnect_agent_url: string | null;
        focas_host: string | null;
        focas_port: number | null;
      }>(
        `SELECT asset_id, control, protocol, mtconnect_agent_url, focas_host, focas_port
           FROM public.shop_machines
          WHERE facility_id = $1 AND organization_id = $2
          ORDER BY asset_id`,
        [facility.facilityId, facility.organizationId],
      );

      const machines = rows
        .map(mapMachineRow)
        .filter((m): m is EdgeConfigMachine => m !== null);

      return jsonResponse(200, { machines });
    });
  } catch (error) {
    console.error("edge-config request failed:", error);
    return jsonResponse(500, { error: "internal error" });
  }
}
