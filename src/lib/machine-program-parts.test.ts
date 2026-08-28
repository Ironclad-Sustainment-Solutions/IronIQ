import { describe, expect, it } from "vitest";
import {
  applyProgramPartLookup,
  assertCanWriteProgramPart,
  findOverlappingMapping,
  mappingWindowsOverlap,
  resolvePartId,
  type ProgramPartWindow,
} from "./machine-program-parts";

const PLANT = "plant-grede-south";
const OTHER_PLANT = "plant-other";

function row(
  over: Partial<ProgramPartWindow> & Pick<ProgramPartWindow, "part_id">,
): ProgramPartWindow {
  return {
    plant_id: PLANT,
    program_name: "O5123",
    valid_from: "2026-01-01T00:00:00.000Z",
    valid_to: null,
    ...over,
  };
}

describe("resolvePartId", () => {
  it("maps O5123 → 38742", () => {
    const mappings = [row({ part_id: "38742" })];
    expect(
      resolvePartId(mappings, PLANT, "O5123", "2026-08-28T12:00:00.000Z"),
    ).toBe("38742");
  });

  it("returns null for an unmapped program", () => {
    const mappings = [row({ part_id: "38742" })];
    expect(
      resolvePartId(mappings, PLANT, "O9999", "2026-08-28T12:00:00.000Z"),
    ).toBeNull();
  });

  it("returns null when the program is mapped on a different plant", () => {
    const mappings = [row({ part_id: "38742" })];
    expect(
      resolvePartId(mappings, OTHER_PLANT, "O5123", "2026-08-28T12:00:00.000Z"),
    ).toBeNull();
  });

  it("ignores expired windows and uses the window that covers the timestamp", () => {
    const mappings = [
      row({
        id: "old",
        part_id: "38742",
        valid_from: "2025-01-01T00:00:00.000Z",
        valid_to: "2026-01-01T00:00:00.000Z",
      }),
      row({
        id: "current",
        part_id: "40001",
        valid_from: "2026-01-01T00:00:00.000Z",
        valid_to: null,
      }),
    ];
    expect(
      resolvePartId(mappings, PLANT, "O5123", "2025-06-15T00:00:00.000Z"),
    ).toBe("38742");
    expect(
      resolvePartId(mappings, PLANT, "O5123", "2026-06-15T00:00:00.000Z"),
    ).toBe("40001");
    // valid_to is exclusive
    expect(
      resolvePartId(mappings, PLANT, "O5123", "2026-01-01T00:00:00.000Z"),
    ).toBe("40001");
    expect(
      resolvePartId(mappings, PLANT, "O5123", "2024-12-31T23:59:59.000Z"),
    ).toBeNull();
  });
});

describe("mapping windows", () => {
  it("treats overlapping windows as a conflict", () => {
    expect(
      mappingWindowsOverlap(
        {
          valid_from: "2026-01-01T00:00:00.000Z",
          valid_to: "2026-06-01T00:00:00.000Z",
        },
        {
          valid_from: "2026-03-01T00:00:00.000Z",
          valid_to: "2026-08-01T00:00:00.000Z",
        },
      ),
    ).toBe(true);
  });

  it("allows adjacent half-open windows for the same program", () => {
    expect(
      mappingWindowsOverlap(
        {
          valid_from: "2026-01-01T00:00:00.000Z",
          valid_to: "2026-06-01T00:00:00.000Z",
        },
        { valid_from: "2026-06-01T00:00:00.000Z", valid_to: null },
      ),
    ).toBe(false);
  });

  it("finds an overlapping row on the same plant and program", () => {
    const existing = [
      row({
        id: "a",
        part_id: "38742",
        valid_from: "2026-01-01T00:00:00.000Z",
        valid_to: null,
      }),
    ];
    expect(
      findOverlappingMapping(existing, {
        id: "b",
        plant_id: PLANT,
        program_name: "O5123",
        part_id: "40001",
        valid_from: "2026-03-01T00:00:00.000Z",
        valid_to: "2026-09-01T00:00:00.000Z",
      })?.id,
    ).toBe("a");
    expect(
      findOverlappingMapping(existing, {
        id: "c",
        plant_id: OTHER_PLANT,
        program_name: "O5123",
        part_id: "40001",
        valid_from: "2026-03-01T00:00:00.000Z",
        valid_to: null,
      }),
    ).toBeNull();
  });
});

describe("assertCanWriteProgramPart", () => {
  it("allows a write in the caller's organization", () => {
    expect(
      assertCanWriteProgramPart({
        requestedOrganizationId: "org-a",
        facilityOrganizationId: "org-a",
      }),
    ).toBe("org-a");
  });

  it("rejects writing another organization's rows", () => {
    expect(() =>
      assertCanWriteProgramPart({
        requestedOrganizationId: "org-a",
        facilityOrganizationId: "org-b",
      }),
    ).toThrow(/another organization's program map/);
  });

  it("rejects a plant the caller cannot see", () => {
    expect(() =>
      assertCanWriteProgramPart({
        requestedOrganizationId: "org-a",
        facilityOrganizationId: null,
      }),
    ).toThrow(/not found or not accessible/);
  });
});

describe("applyProgramPartLookup", () => {
  it("keeps program_name and leaves part_id null when unmapped", () => {
    expect(applyProgramPartLookup("O5123", null)).toEqual({
      program_name: "O5123",
      part_id: null,
    });
  });

  it("fills part_id when the map hits", () => {
    expect(applyProgramPartLookup("O5123", "38742")).toEqual({
      program_name: "O5123",
      part_id: "38742",
    });
  });
});
