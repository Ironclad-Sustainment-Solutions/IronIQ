/**
 * Shop-floor machine master + run events for a small-machine pilot.
 * Manual and CSV only — no live MTConnect / OPC-UA / Fanuc client.
 */

export const MACHINE_CONTROLS = [
  "fanuc",
  "haas",
  "mazak",
  "siemens",
  "other",
] as const;
export type MachineControl = (typeof MACHINE_CONTROLS)[number];

export const MACHINE_PROTOCOLS = [
  "none",
  "mtconnect",
  "opc_ua",
  "fanuc_focas",
  "manual",
] as const;
export type MachineProtocol = (typeof MACHINE_PROTOCOLS)[number];

export const CONNECTION_STATUSES = ["not_connected", "manual", "live"] as const;
export type ConnectionStatus = (typeof CONNECTION_STATUSES)[number];

export const RUN_SOURCES = ["manual", "csv"] as const;
export type RunSource = (typeof RUN_SOURCES)[number];

export const CONTROL_LABELS: Record<MachineControl, string> = {
  fanuc: "Fanuc",
  haas: "Haas",
  mazak: "Mazak",
  siemens: "Siemens",
  other: "Other",
};

export const PROTOCOL_LABELS: Record<MachineProtocol, string> = {
  none: "None",
  mtconnect: "MTConnect",
  opc_ua: "OPC-UA",
  fanuc_focas: "Fanuc FOCAS",
  manual: "Manual",
};

export const CONNECTION_LABELS: Record<ConnectionStatus, string> = {
  not_connected: "Not connected",
  manual: "Manual",
  live: "Live",
};

export const RUN_CSV_HEADERS = [
  "timestamp",
  "part_number",
  "cycles",
  "runtime_minutes",
  "idle_minutes",
  "downtime_minutes",
] as const;

export interface ShopMachine {
  id: string;
  organization_id: string;
  facility_id: string;
  asset_id: string;
  name: string;
  make: string;
  model: string;
  control: MachineControl;
  protocol: MachineProtocol;
  connection_status: ConnectionStatus;
  location: string | null;
  created_at: string;
  updated_at: string;
}

export interface MachineRunEvent {
  id: string;
  machine_id: string;
  organization_id: string;
  facility_id: string;
  occurred_at: string;
  part_number: string;
  cycles: number;
  runtime_minutes: number;
  idle_minutes: number;
  downtime_minutes: number;
  source: RunSource;
  created_at: string;
}

export interface ParsedRunRow {
  occurred_at: string;
  part_number: string;
  cycles: number;
  runtime_minutes: number;
  idle_minutes: number;
  downtime_minutes: number;
}

export interface RunTotals {
  cycles: number;
  runtime_minutes: number;
  idle_minutes: number;
  downtime_minutes: number;
  hours: number;
}

export interface HoursByPart {
  part_number: string;
  hours: number;
  cycles: number;
  runtime_minutes: number;
}

export interface MachineRunSummary {
  lastRun: MachineRunEvent | null;
  totals: RunTotals;
  hoursByPart: HoursByPart[];
  last20: MachineRunEvent[];
}

export function machineLabel(machine: Pick<ShopMachine, "asset_id" | "name">) {
  return `${machine.asset_id} — ${machine.name}`;
}

function num(value: unknown, field: string): number {
  if (value === "" || value === null || value === undefined) {
    throw new Error(`${field} is required`);
  }
  const n = typeof value === "number" ? value : Number(String(value).trim());
  if (!Number.isFinite(n) || n < 0) {
    throw new Error(`${field} must be a number 0 or greater`);
  }
  return n;
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      cells.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  cells.push(current.trim());
  return cells;
}

export function parseRunCsv(text: string): ParsedRunRow[] {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length === 0) {
    throw new Error("CSV is empty");
  }

  const header = splitCsvLine(lines[0]).map((h) =>
    h.toLowerCase().replace(/\s+/g, "_"),
  );
  const expected = [...RUN_CSV_HEADERS];
  const missing = expected.filter((h) => !header.includes(h));
  if (missing.length > 0) {
    throw new Error(
      `CSV is missing required headers: ${missing.join(", ")}. Expected: ${expected.join(", ")}`,
    );
  }

  const index = Object.fromEntries(header.map((h, i) => [h, i]));
  const rows: ParsedRunRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]);
    const timestamp = cells[index.timestamp] ?? "";
    const occurred = new Date(timestamp);
    if (!timestamp || Number.isNaN(occurred.getTime())) {
      throw new Error(`Row ${i + 1}: timestamp is not a valid date`);
    }
    const part_number = (cells[index.part_number] ?? "").trim();
    if (!part_number) {
      throw new Error(`Row ${i + 1}: part_number is required`);
    }
    rows.push({
      occurred_at: occurred.toISOString(),
      part_number,
      cycles: num(cells[index.cycles], `Row ${i + 1}: cycles`),
      runtime_minutes: num(
        cells[index.runtime_minutes],
        `Row ${i + 1}: runtime_minutes`,
      ),
      idle_minutes: num(
        cells[index.idle_minutes],
        `Row ${i + 1}: idle_minutes`,
      ),
      downtime_minutes: num(
        cells[index.downtime_minutes],
        `Row ${i + 1}: downtime_minutes`,
      ),
    });
  }

  return rows;
}

export function emptyTotals(): RunTotals {
  return {
    cycles: 0,
    runtime_minutes: 0,
    idle_minutes: 0,
    downtime_minutes: 0,
    hours: 0,
  };
}

export function addRunToTotals(
  totals: RunTotals,
  run: Pick<
    MachineRunEvent,
    "cycles" | "runtime_minutes" | "idle_minutes" | "downtime_minutes"
  >,
): RunTotals {
  const runtime_minutes = totals.runtime_minutes + Number(run.runtime_minutes);
  return {
    cycles: totals.cycles + Number(run.cycles),
    runtime_minutes,
    idle_minutes: totals.idle_minutes + Number(run.idle_minutes),
    downtime_minutes: totals.downtime_minutes + Number(run.downtime_minutes),
    hours: Math.round((runtime_minutes / 60) * 100) / 100,
  };
}

export function summarizeMachineRuns(
  runs: MachineRunEvent[],
  selectedPart?: string | null,
): MachineRunSummary {
  const ordered = [...runs].sort(
    (a, b) =>
      new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime(),
  );
  const scoped = selectedPart
    ? ordered.filter((r) => r.part_number === selectedPart)
    : ordered;

  const totals = scoped.reduce(addRunToTotals, emptyTotals());
  const byPart = new Map<string, HoursByPart>();
  for (const run of ordered) {
    const current = byPart.get(run.part_number) ?? {
      part_number: run.part_number,
      hours: 0,
      cycles: 0,
      runtime_minutes: 0,
    };
    current.cycles += Number(run.cycles);
    current.runtime_minutes += Number(run.runtime_minutes);
    current.hours = Math.round((current.runtime_minutes / 60) * 100) / 100;
    byPart.set(run.part_number, current);
  }

  return {
    lastRun: ordered[0] ?? null,
    totals,
    hoursByPart: [...byPart.values()].sort(
      (a, b) => b.runtime_minutes - a.runtime_minutes,
    ),
    last20: ordered.slice(0, 20),
  };
}

export interface BeforeAfterNumbers {
  cycle_time_sec_before: number;
  cycle_time_sec_after: number;
  setup_min_before: number;
  setup_min_after: number;
  hours_on_part_before: number;
  hours_on_part_after: number;
  parts_per_shift_before?: number | null;
  parts_per_shift_after?: number | null;
  downtime_min_before?: number | null;
  downtime_min_after?: number | null;
}

export interface BeforeAfterDeltas {
  cycle_time_sec: number;
  setup_min: number;
  hours_on_part: number;
  parts_per_shift: number | null;
  downtime_min: number | null;
}

export function beforeAfterDeltas(
  values: BeforeAfterNumbers,
): BeforeAfterDeltas {
  const delta = (before: number, after: number) =>
    Math.round((after - before) * 1000) / 1000;
  const optional = (
    before: number | null | undefined,
    after: number | null | undefined,
  ) =>
    before === null ||
    before === undefined ||
    after === null ||
    after === undefined
      ? null
      : delta(before, after);

  return {
    cycle_time_sec: delta(
      values.cycle_time_sec_before,
      values.cycle_time_sec_after,
    ),
    setup_min: delta(values.setup_min_before, values.setup_min_after),
    hours_on_part: delta(
      values.hours_on_part_before,
      values.hours_on_part_after,
    ),
    parts_per_shift: optional(
      values.parts_per_shift_before,
      values.parts_per_shift_after,
    ),
    downtime_min: optional(
      values.downtime_min_before,
      values.downtime_min_after,
    ),
  };
}

export function formatDelta(value: number | null, unit: string): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value} ${unit}`;
}

export interface ShopPart {
  id: string;
  organization_id: string;
  facility_id: string | null;
  part_number: string;
  description: string | null;
  drawing_ref: string | null;
}

export interface PartOutcomeCard extends BeforeAfterNumbers {
  id: string;
  organization_id: string;
  facility_id: string | null;
  part_id: string;
  machine_id: string | null;
  cnc_change_log_id: string | null;
  capability_action_id: string | null;
  part_number: string;
  part_description: string | null;
  drawing_ref: string | null;
  machine_label: string | null;
  what_changed: string;
  before_at: string | null;
  after_at: string | null;
  created_at: string;
}

export function looksLikePartNumberField(name: string): boolean {
  return /part[\s_-]*number|part\s*#|p\/n|\bpn\b/i.test(name);
}

export const REQUIRED_BEFORE_AFTER_FIELDS = [
  "cycle_time_sec_before",
  "cycle_time_sec_after",
  "setup_min_before",
  "setup_min_after",
  "hours_on_part_before",
  "hours_on_part_after",
] as const;

export function parseRequiredNumber(value: string, label: string): number {
  const n = Number(value);
  if (value.trim() === "" || !Number.isFinite(n) || n < 0) {
    throw new Error(`${label} is required and must be 0 or greater`);
  }
  return n;
}

export function parseOptionalNumber(value: string): number | null {
  if (value.trim() === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) {
    throw new Error("Optional numbers must be 0 or greater");
  }
  return n;
}

export function isCycleRuntimeQuestion(question: string): boolean {
  return /\b(cycle(?:\s*time)?s?|runtime|run[-\s]?time|hours?\s+on\s+part|idle\s+time|downtime)\b/i.test(
    question,
  );
}
