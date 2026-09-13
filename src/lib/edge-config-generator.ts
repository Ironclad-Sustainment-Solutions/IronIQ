/**
 * Generates a real, ready-to-use edge.config.json client-side -- no
 * server round trip needed, everything required is already on the page
 * (the app's own URL, a freshly-generated facility key, and whatever
 * machine data is already on file). Exists specifically to close a real
 * gap: someone who just downloaded the Edge agent had to hand-type this
 * whole file from a template in the setup guide, including copying a
 * key exactly right by hand -- genuinely error-prone for something that
 * doesn't need to be manual at all.
 */

const CONTROLLER_MAKE_LABELS: Record<string, string> = {
  fanuc: "Fanuc",
  haas: "Haas",
  mazak: "Mazak",
  siemens: "Siemens",
  other: "Other",
};

function controllerMakeLabel(control: string): string {
  return CONTROLLER_MAKE_LABELS[control] ?? "Other";
}

export interface EdgeConfigMachineInput {
  asset_id: string;
  control: string;
  protocol: string;
  mtconnect_agent_url: string | null;
}

type EdgeConfigMachineEntry =
  | {
      asset_id: string;
      protocol: "mtconnect";
      mtconnect_url: string;
      controller_make: string;
    }
  | {
      asset_id: string;
      protocol: "focas";
      focas_host: string;
      focas_port: number;
      controller_make: string;
    };

const PLACEHOLDER_MACHINE: EdgeConfigMachineEntry = {
  asset_id: "<matches this machine's Asset ID in IronIQ>",
  protocol: "mtconnect",
  mtconnect_url: "http://<machine-lan-ip>:8082",
  controller_make: "Haas",
};

/**
 * Maps a real shop_machines record onto an Edge config entry -- only
 * for machines whose protocol the Edge agent actually knows how to
 * speak (mtconnect, fanuc_focas). Machines set to "none", "opc_ua", or
 * "manual" are deliberately left out rather than generating an entry
 * that would silently be wrong -- OPC-UA isn't supported by the Edge
 * agent at all yet, and "none"/"manual" mean nobody has said this
 * machine has a live connection method in the first place.
 */
export function buildEdgeConfigMachines(
  machines: EdgeConfigMachineInput[],
): EdgeConfigMachineEntry[] {
  const entries: EdgeConfigMachineEntry[] = [];
  for (const m of machines) {
    if (m.protocol === "mtconnect") {
      entries.push({
        asset_id: m.asset_id,
        protocol: "mtconnect",
        // Real, already-on-file URL if this machine has one -- makes
        // this specific entry immediately usable with zero editing.
        // Falls back to the same placeholder the setup guide's own
        // manual template uses if it doesn't.
        mtconnect_url: m.mtconnect_agent_url || "http://<machine-lan-ip>:8082",
        controller_make: controllerMakeLabel(m.control),
      });
    } else if (m.protocol === "fanuc_focas") {
      entries.push({
        asset_id: m.asset_id,
        protocol: "focas",
        focas_host: "<machine-lan-ip>",
        focas_port: 8193,
        controller_make: controllerMakeLabel(m.control),
      });
    }
  }
  return entries;
}

export interface BuildEdgeConfigInput {
  baseUrl: string;
  facilityKey: string;
  plantId: string;
  machines: EdgeConfigMachineInput[];
}

/** Returns pretty-printed JSON text, ready to save directly as edge.config.json. */
export function buildEdgeConfigJson(input: BuildEdgeConfigInput): string {
  const machines = buildEdgeConfigMachines(input.machines);
  const config = {
    ironiq_url: input.baseUrl,
    facility_key: input.facilityKey,
    plant_id: input.plantId,
    // Never an empty array -- a facility with no Edge-compatible
    // machines on file yet still gets a real, editable starting point
    // rather than a config that would immediately fail with "no
    // machines configured."
    machines: machines.length > 0 ? machines : [PLACEHOLDER_MACHINE],
  };
  return JSON.stringify(config, null, 2);
}
