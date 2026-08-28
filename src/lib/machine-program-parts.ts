/**
 * Program → part map for machine capture V1.
 *
 * The control sends an O-number (O1234). IronIQ maps it to a part.
 * Validity windows are half-open [valid_from, valid_to); a second window
 * is only needed when the same program is later used on a different part.
 */

export interface MachineProgramPart {
  id: string;
  organization_id: string;
  facility_id: string;
  plant_id: string;
  program_name: string;
  part_id: string;
  valid_from: string;
  valid_to: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProgramPartWindow {
  plant_id: string;
  program_name: string;
  part_id: string;
  valid_from: string;
  valid_to: string | null;
  id?: string;
}

function atMs(value: string | Date): number {
  const n = value instanceof Date ? value.getTime() : new Date(value).getTime();
  if (Number.isNaN(n)) {
    throw new Error("timestamp is not a valid date");
  }
  return n;
}

export function mappingCovers(
  row: Pick<ProgramPartWindow, "valid_from" | "valid_to">,
  at: string | Date,
): boolean {
  const t = atMs(at);
  if (t < atMs(row.valid_from)) return false;
  if (row.valid_to == null || row.valid_to === "") return true;
  return t < atMs(row.valid_to);
}

/** Given plant, program, and timestamp → part_id or null. */
export function resolvePartId(
  rows: readonly ProgramPartWindow[],
  plantId: string,
  programName: string,
  at: string | Date,
): string | null {
  const name = programName.trim();
  const matches = rows.filter(
    (row) =>
      row.plant_id === plantId &&
      row.program_name === name &&
      mappingCovers(row, at),
  );
  if (matches.length === 0) return null;
  matches.sort((a, b) => atMs(b.valid_from) - atMs(a.valid_from));
  return matches[0].part_id;
}

/** Half-open [valid_from, valid_to) overlap. Adjacent windows do not overlap. */
export function mappingWindowsOverlap(
  a: Pick<ProgramPartWindow, "valid_from" | "valid_to">,
  b: Pick<ProgramPartWindow, "valid_from" | "valid_to">,
): boolean {
  const aFrom = atMs(a.valid_from);
  const bFrom = atMs(b.valid_from);
  const aTo =
    a.valid_to == null || a.valid_to === ""
      ? Number.POSITIVE_INFINITY
      : atMs(a.valid_to);
  const bTo =
    b.valid_to == null || b.valid_to === ""
      ? Number.POSITIVE_INFINITY
      : atMs(b.valid_to);
  return aFrom < bTo && bFrom < aTo;
}

export function findOverlappingMapping(
  existing: readonly ProgramPartWindow[],
  candidate: ProgramPartWindow,
): ProgramPartWindow | null {
  const name = candidate.program_name.trim();
  return (
    existing.find(
      (row) =>
        row.plant_id === candidate.plant_id &&
        row.program_name.trim() === name &&
        row.id !== candidate.id &&
        mappingWindowsOverlap(row, candidate),
    ) ?? null
  );
}

/**
 * Editor writes are org-scoped: the plant (facility) must belong to the
 * organization the caller asked to write. A missing facility is treated as
 * inaccessible (RLS hid another org's row, or the id is wrong).
 */
export function assertCanWriteProgramPart(input: {
  requestedOrganizationId: string;
  facilityOrganizationId: string | null | undefined;
}): string {
  if (!input.facilityOrganizationId) {
    throw new Error("Plant not found or not accessible.");
  }
  if (input.facilityOrganizationId !== input.requestedOrganizationId) {
    throw new Error("Cannot write another organization's program map.");
  }
  return input.facilityOrganizationId;
}

/** Ingest contract: always keep program_name; part_id is null until mapped. */
export function applyProgramPartLookup(
  programName: string,
  mappedPartId: string | null,
): { program_name: string; part_id: string | null } {
  return {
    program_name: programName,
    part_id: mappedPartId,
  };
}
