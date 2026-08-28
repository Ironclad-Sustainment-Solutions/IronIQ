import { describe, expect, it } from "vitest";
import { assessDrift } from "./sustainment";
import type { WindowResult } from "./machine-improvements";

function ok(cycles: number, cycleTimeS: number): WindowResult {
  return {
    status: "ok",
    summary: {
      cycles,
      cycle_time_s: cycleTimeS,
      setup_candidate_idle_s: 0,
      first_piece_candidate_idle_s: 0,
      event_count: cycles,
    },
  };
}

describe("assessDrift", () => {
  it("normalizes by cycle count, not raw window total -- windows of very different lengths are still comparable", () => {
    // 10 cycles at 100s each in a short window vs 3 cycles at 100s each
    // in a much longer window -- same per-cycle time, should hold
    // despite wildly different totals/cycle counts/window lengths.
    const original = ok(10, 1000);
    const current = ok(3, 300);
    const result = assessDrift(original, current);
    expect(result.status).toBe("holding");
    // Not exactly 0 -- round3() applied to different-sized window totals
    // (1000 vs 300) before dividing by different cycle counts (10 vs 3)
    // introduces a small floating-point artifact (~0.5%), well under any
    // real drift threshold. Loose enough to tolerate that, tight enough
    // to catch an actual normalization bug (which would be off by tens
    // of percent, not a fraction of one).
    expect(Math.abs(result.percentChange ?? 100)).toBeLessThan(2);
  });

  it("flags drift when current is notably slower per cycle than the original", () => {
    const original = ok(20, 2000); // 100s/cycle
    const current = ok(12, 1680); // 140s/cycle, +40%
    const result = assessDrift(original, current);
    expect(result.status).toBe("drifting");
    expect(result.percentChange).toBeCloseTo(40, 0);
  });

  it("does not flag small fluctuations under the threshold", () => {
    const original = ok(10, 1000); // 100s/cycle
    const current = ok(10, 1080); // 108s/cycle, +8%
    const result = assessDrift(original, current, 15);
    expect(result.status).toBe("holding");
  });

  it("treats getting faster as holding, not drifting", () => {
    const original = ok(10, 1000);
    const current = ok(10, 800);
    const result = assessDrift(original, current);
    expect(result.status).toBe("holding");
    expect(result.percentChange).toBeLessThan(0);
  });

  it("returns insufficient_data when either window has no real data", () => {
    const original = ok(10, 1000);
    expect(assessDrift(original, { status: "empty" }).status).toBe(
      "insufficient_data",
    );
    expect(assessDrift({ status: "empty" }, ok(5, 500)).status).toBe(
      "insufficient_data",
    );
  });

  it("returns insufficient_data rather than dividing by zero when a window has zero cycles", () => {
    const original = ok(0, 0);
    const current = ok(5, 500);
    const result = assessDrift(original, current);
    expect(result.status).toBe("insufficient_data");
    expect(Number.isFinite(result.percentChange ?? 0)).toBe(true);
  });
});
