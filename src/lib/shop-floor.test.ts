import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  beforeAfterDeltas,
  formatDelta,
  isCycleRuntimeQuestion,
  looksLikePartNumberField,
  parseRunCsv,
  summarizeMachineRuns,
  type MachineRunEvent,
} from "./shop-floor";

const sample = `timestamp,part_number,cycles,runtime_minutes,idle_minutes,downtime_minutes
2026-08-25T08:00:00Z,HUB-4410,42,180,30,10
2026-08-26T08:00:00Z,HUB-4410,38,165,40,15
2026-08-26T16:00:00Z,BRK-220,12,60,20,5
`;

function run(
  partial: Partial<MachineRunEvent> &
    Pick<MachineRunEvent, "part_number" | "occurred_at">,
): MachineRunEvent {
  return {
    id: partial.id ?? crypto.randomUUID(),
    machine_id: "m1",
    organization_id: "o1",
    facility_id: "f1",
    cycles: 10,
    runtime_minutes: 60,
    idle_minutes: 10,
    downtime_minutes: 5,
    source: "csv",
    created_at: partial.occurred_at,
    ...partial,
  };
}

describe("parseRunCsv", () => {
  it("parses the documented headers into run rows", () => {
    const rows = parseRunCsv(sample);
    expect(rows).toHaveLength(3);
    expect(rows[0].part_number).toBe("HUB-4410");
    expect(rows[0].cycles).toBe(42);
    expect(rows[2].part_number).toBe("BRK-220");
    expect(rows[2].runtime_minutes).toBe(60);
  });

  it("parses the sample CSV in the repo", () => {
    const csv = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "../../samples/shop-floor-runs.csv"),
      "utf8",
    );
    const rows = parseRunCsv(csv);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.part_number && r.cycles >= 0)).toBe(true);
  });

  it("rejects a CSV missing required headers", () => {
    expect(() => parseRunCsv("timestamp,cycles\n2026-08-25,1")).toThrow(
      /missing required headers/,
    );
  });
});

describe("summarizeMachineRuns", () => {
  it("computes last cycle, totals, hours by part, and last 20", () => {
    const rows = parseRunCsv(sample).map((row, i) =>
      run({
        id: String(i),
        occurred_at: row.occurred_at,
        part_number: row.part_number,
        cycles: row.cycles,
        runtime_minutes: row.runtime_minutes,
        idle_minutes: row.idle_minutes,
        downtime_minutes: row.downtime_minutes,
      }),
    );
    const summary = summarizeMachineRuns(rows);
    expect(summary.lastRun?.part_number).toBe("BRK-220");
    expect(summary.totals.cycles).toBe(92);
    expect(summary.totals.runtime_minutes).toBe(405);
    expect(summary.totals.hours).toBe(6.75);
    expect(summary.hoursByPart[0]).toMatchObject({
      part_number: "HUB-4410",
      hours: 5.75,
      cycles: 80,
    });
    expect(summary.last20).toHaveLength(3);

    const hubOnly = summarizeMachineRuns(rows, "HUB-4410");
    expect(hubOnly.totals.cycles).toBe(80);
    expect(hubOnly.totals.hours).toBe(5.75);
  });
});

describe("beforeAfterDeltas", () => {
  it("computes after minus before, including optional fields", () => {
    const deltas = beforeAfterDeltas({
      cycle_time_sec_before: 145,
      cycle_time_sec_after: 128,
      setup_min_before: 40,
      setup_min_after: 22,
      hours_on_part_before: 12,
      hours_on_part_after: 9.5,
      parts_per_shift_before: 80,
      parts_per_shift_after: 96,
      downtime_min_before: 30,
      downtime_min_after: 12,
    });
    expect(deltas.cycle_time_sec).toBe(-17);
    expect(deltas.setup_min).toBe(-18);
    expect(deltas.hours_on_part).toBe(-2.5);
    expect(deltas.parts_per_shift).toBe(16);
    expect(deltas.downtime_min).toBe(-18);
    expect(formatDelta(deltas.cycle_time_sec, "sec")).toBe("-17 sec");
  });
});

describe("looksLikePartNumberField", () => {
  it("joins title-block part number fields", () => {
    expect(looksLikePartNumberField("Part Number")).toBe(true);
    expect(looksLikePartNumberField("P/N")).toBe(true);
    expect(looksLikePartNumberField("Material")).toBe(false);
  });
});

describe("isCycleRuntimeQuestion", () => {
  it("detects cycle/runtime questions for the honest no-precedent path", () => {
    expect(isCycleRuntimeQuestion("What was cycle time on HUB-4410?")).toBe(
      true,
    );
    expect(isCycleRuntimeQuestion("hours on part last week")).toBe(true);
    expect(isCycleRuntimeQuestion("How do we document a fixture change?")).toBe(
      false,
    );
  });
});
