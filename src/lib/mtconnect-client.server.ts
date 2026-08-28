/**
 * Real MTConnect (https://www.mtconnect.org/) client -- the only one of
 * shop_machine_protocol's three live options (mtconnect, opc_ua,
 * fanuc_focas) that's a plain HTTP+XML REST API with a public, stable
 * spec. OPC-UA needs a binary protocol client library and FOCAS needs
 * Fanuc's own vendor SDK; neither can be meaningfully built or tested
 * from a sandboxed dev environment with no access to real shop-floor
 * hardware. This talks the actual MTConnect protocol correctly: GET
 * .../probe to discover devices, GET .../current to read the latest
 * DataItem values.
 *
 * Real MTConnect agents vary in exactly how they nest ComponentStreams
 * (by control vs path vs axes, differently per vendor), so rather than
 * hardcode a specific hierarchy, this searches every element under the
 * matched DeviceStream for the DataItem *types* it needs by local tag
 * name -- robust to structural differences between agent
 * implementations, at the cost of not distinguishing "which axis/path"
 * if a device reports more than one of the same type (uncommon for the
 * single-spindle machines this pilot targets).
 */

import { DOMParser } from "@xmldom/xmldom";

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

export interface MTConnectProbeResult {
  devices: { name: string; uuid: string | null }[];
}

const EXECUTION_ACTIVE = new Set(["ACTIVE"]);
const EXECUTION_IDLE = new Set([
  "READY",
  "STOPPED",
  "PROGRAM_STOPPED",
  "PROGRAM_COMPLETED",
  "OPTIONAL_STOP",
  "INTERRUPTED",
  "FEED_HOLD",
]);

function stripTrailingSlash(url: string): string {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

// IronIQ's cloud servers can only ever reach a public IP/hostname --
// never a private LAN address, no matter how correctly everything else
// is configured. This is genuinely common to get wrong (a private
// address looks completely normal from inside the customer's own
// network), so rather than let it surface as a bare, confusing network
// error, detect the common private ranges and say so directly.
function isLikelyUnreachablePrivateHost(hostname: string): boolean {
  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1"
  ) {
    return true;
  }
  const parts = hostname.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p))) return false;
  const [a, b] = parts;
  return (
    a === 10 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 169 && b === 254) // link-local
  );
}

async function fetchXml(url: string, timeoutMs = 10_000): Promise<Document> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;
  try {
    response = await fetch(url, { signal: controller.signal });
  } catch (error) {
    let hostname = "";
    try {
      hostname = new URL(url).hostname;
    } catch {
      // ignore -- url was already validated further up the call chain
    }
    const hint = isLikelyUnreachablePrivateHost(hostname)
      ? ` "${hostname}" looks like a private network address (e.g. 192.168.x.x, 10.x.x.x, or localhost) -- IronIQ's cloud servers can only reach a public IP or hostname, never a private one on your local network, no matter how everything else is configured. This URL needs to be reachable from the public internet (a public IP/hostname, or a firewall rule forwarding a specific port).`
      : "";
    throw new Error(
      `Could not reach MTConnect agent at ${url}: ${error instanceof Error ? error.message : String(error)}.${hint}`,
    );
  } finally {
    clearTimeout(timeout);
  }
  if (!response.ok) {
    throw new Error(
      `MTConnect agent at ${url} returned HTTP ${response.status}.`,
    );
  }
  const text = await response.text();
  const doc = new DOMParser({
    errorHandler: {
      warning: () => {},
      error: (msg: string) => {
        throw new Error(`MTConnect agent response wasn't valid XML: ${msg}`);
      },
      fatalError: (msg: string) => {
        throw new Error(`MTConnect agent response wasn't valid XML: ${msg}`);
      },
    },
  }).parseFromString(text, "text/xml");
  return doc;
}

function findDeviceStream(doc: Document, deviceName?: string | null): Element {
  const streams = doc.getElementsByTagName("DeviceStream");
  if (streams.length === 0) {
    throw new Error(
      "MTConnect agent response had no DeviceStream -- is the device name correct?",
    );
  }
  if (deviceName) {
    for (let i = 0; i < streams.length; i++) {
      const el = streams[i];
      if (el.getAttribute("name") === deviceName) return el;
    }
    const available = Array.from({ length: streams.length }, (_, i) =>
      streams[i].getAttribute("name"),
    ).join(", ");
    throw new Error(
      `MTConnect agent doesn't have a device named "${deviceName}". Devices available: ${available}.`,
    );
  }
  return streams[0];
}

function firstByTag(el: Element, tag: string): Element | null {
  const found = el.getElementsByTagName(tag);
  return found.length > 0 ? found[0] : null;
}

/** GET {agentUrl}/probe -- lists devices the agent knows about, for setup validation. */
export async function mtconnectProbe(
  agentUrl: string,
): Promise<MTConnectProbeResult> {
  const doc = await fetchXml(`${stripTrailingSlash(agentUrl)}/probe`);
  const deviceEls = doc.getElementsByTagName("Device");
  const devices: MTConnectProbeResult["devices"] = [];
  for (let i = 0; i < deviceEls.length; i++) {
    const el = deviceEls[i];
    devices.push({
      name: el.getAttribute("name") ?? "",
      uuid: el.getAttribute("uuid"),
    });
  }
  if (devices.length === 0) {
    throw new Error("MTConnect agent's /probe response had no Device entries.");
  }
  return { devices };
}

/** GET {agentUrl}/current -- the latest value of every DataItem for the matched device. */
export async function mtconnectCurrent(
  agentUrl: string,
  deviceName?: string | null,
): Promise<MTConnectCurrentReading> {
  const doc = await fetchXml(`${stripTrailingSlash(agentUrl)}/current`);

  const header = doc.getElementsByTagName("Header")[0] ?? null;
  const sequenceAttr =
    header?.getAttribute("lastSequence") ??
    header?.getAttribute("nextSequence");
  const sequence = sequenceAttr ? Number(sequenceAttr) : null;

  const deviceStream = findDeviceStream(doc, deviceName);
  const resolvedName =
    deviceStream.getAttribute("name") ?? deviceName ?? "unknown";

  const executionEl = firstByTag(deviceStream, "Execution");
  const availabilityEl = firstByTag(deviceStream, "Availability");
  const partCountEl =
    firstByTag(deviceStream, "PartCount") ??
    firstByTag(deviceStream, "PartCountAct");
  const partNumberEl =
    firstByTag(deviceStream, "PartNumber") ??
    firstByTag(deviceStream, "PartNumberAct");

  const rawExecution = executionEl?.textContent?.trim() ?? null;
  const rawAvailability = availabilityEl?.textContent?.trim() ?? null;

  let state: MTConnectCurrentReading["state"];
  if (rawExecution && EXECUTION_ACTIVE.has(rawExecution)) {
    state = "active";
  } else if (rawExecution && EXECUTION_IDLE.has(rawExecution)) {
    state = "idle";
  } else if (
    rawExecution === "UNAVAILABLE" ||
    rawAvailability === "UNAVAILABLE"
  ) {
    state = "down";
  } else if (!rawExecution) {
    // Neither Execution nor a recognized Availability value at all --
    // the agent isn't telling us anything useful about machine state,
    // treat as down rather than silently assuming idle.
    state = "down";
  } else {
    // An Execution value that exists but isn't in either known set
    // (agent-specific extension value) -- treat as idle rather than
    // guessing it's actively cutting.
    state = "idle";
  }

  const partCountRaw = partCountEl?.textContent?.trim();
  const partCount =
    partCountRaw && !Number.isNaN(Number(partCountRaw))
      ? Number(partCountRaw)
      : null;

  const timestamp =
    executionEl?.getAttribute("timestamp") ??
    partCountEl?.getAttribute("timestamp") ??
    header?.getAttribute("creationTime") ??
    new Date().toISOString();

  return {
    deviceName: resolvedName,
    sequence,
    timestamp,
    state,
    rawExecution,
    partCount,
    partNumber: partNumberEl?.textContent?.trim() || null,
  };
}
