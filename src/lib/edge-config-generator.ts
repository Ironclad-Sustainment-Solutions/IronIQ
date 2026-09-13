/**
 * Generates a real, ready-to-use edge.config.json client-side -- no
 * server round trip needed, everything required is already on the page
 * (the app's own URL, a freshly-generated facility key, and the
 * facility's name).
 *
 * Deliberately does NOT include a machines[] array anymore. Earlier this
 * did include one, pre-filled from whatever machine data happened to be
 * on file -- an improvement over hand-typing one, but it meant editing a
 * machine's protocol/connection details in the app didn't take effect
 * until someone re-downloaded and swapped in a new config file. Now the
 * Edge agent fetches its current machine list directly from IronIQ
 * (GET /api/ironiq/v1/edge-config, authenticated with this same facility
 * key -- see edge-machine-config.server.ts and edge/remote_config.go),
 * so the machine list lives in IronIQ's own machine records and their
 * existing edit forms, not in a file at all. This downloaded file is
 * now genuinely just the one-time bootstrap: which IronIQ instance,
 * which facility. Nothing here needs to change again just because a
 * machine's protocol or connection details changed in the app.
 */

export interface BuildEdgeConfigInput {
  baseUrl: string;
  facilityKey: string;
  plantId: string;
}

/** Returns pretty-printed JSON text, ready to save directly as edge.config.json. */
export function buildEdgeConfigJson(input: BuildEdgeConfigInput): string {
  const config = {
    ironiq_url: input.baseUrl,
    facility_key: input.facilityKey,
    plant_id: input.plantId,
  };
  return JSON.stringify(config, null, 2);
}
