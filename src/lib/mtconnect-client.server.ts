/**
 * The MTConnect reading shape shared between the bridge agent's push
 * payload (bridge/main.go's JSON body) and machine-ingest.server.ts's
 * validation of it.
 *
 * This file used to contain a real fetch-based MTConnect client
 * (mtconnectProbe/mtconnectCurrent, calling out to an agent URL
 * directly) for a cloud-pull design. That design was broken for any
 * real deployment: the cloud server can't reach a private LAN address
 * on a customer's network, which is where a real MTConnect agent lives.
 * Replaced with a push model -- a small on-prem bridge agent
 * (bridge/main.go, a Go port of the same parsing logic that used to
 * live here) polls the local agent and pushes readings to
 * machine-ingest.server.ts's plain HTTP endpoint instead. Only the
 * shape of a reading is still shared code; the actual HTTP+XML client
 * now lives in Go, not here, since nothing on the cloud side ever
 * fetches an MTConnect agent directly anymore.
 */

export interface MTConnectCurrentReading {
  /** The device name actually matched in the response (for confirming setup). */
  deviceName: string;
  /** MTConnect's own sequence number for this reading, from the Header. */
  sequence: number | null;
  /** ISO timestamp this reading was taken, from the DataItem or Header. */
  timestamp: string;
  /**
   * Best-effort machine state, derived from Execution (preferred) or
   * Availability (fallback) per the MTConnect standard's own semantics --
   * not invented: ACTIVE means cutting; READY/STOPPED/PROGRAM_STOPPED/
   * PROGRAM_COMPLETED/OPTIONAL_STOP/INTERRUPTED/FEED_HOLD mean idle;
   * UNAVAILABLE (or no Execution/Availability DataItem reporting at all)
   * means the agent can't currently see the control, i.e. down.
   */
  state: "active" | "idle" | "down";
  rawExecution: string | null;
  /** Cumulative part count since whatever epoch the control uses, if the agent reports one. */
  partCount: number | null;
  /** Current part number/program identifier, if the agent reports one directly. */
  partNumber: string | null;
}
