/**
 * Sustainment = "is a fix still holding," from two different sources
 * that both already exist but were never rolled up anywhere:
 *
 * 1. Human-reported: cap_validations, already collected via the
 *    Capability Assessment's RestorationPanel (the seven
 *    SUSTAINMENT_QUESTIONS) -- a person periodically checks in on a
 *    corrective action and records whether it's still working.
 * 2. Telemetry-verified: real IronIQ Edge machine event data. A
 *    shop_machine_improvements record already proves a one-time
 *    before/after gain at the moment it was made -- this file adds the
 *    other half: comparing that original "after" performance against a
 *    FRESH, current window, to catch drift a human check-in might miss
 *    or might not have happened yet. Reuses the exact same
 *    hoursToMakePart/WindowResult machinery already built and tested for
 *    machine-improvements.ts's before/after comparison, applied to a
 *    different pair of windows.
 */

import { hoursToMakePart, type WindowResult } from "@/lib/machine-improvements";

export type DriftStatus = "holding" | "drifting" | "insufficient_data";

export interface DriftAssessment {
  status: DriftStatus;
  originalHoursPerPart: number | null;
  currentHoursPerPart: number | null;
  /** Positive = current is slower than the original after-window; negative = still faster. */
  percentChange: number | null;
}

/**
 * hoursToMakePart (from machine-improvements.ts) is a window TOTAL, not
 * a per-part average -- correct for a normal before/after comparison,
 * where both windows are the same configured length
 * (window_before_hours vs window_after_hours). A sustainment check
 * compares that original after-window against a "current" window of a
 * DIFFERENT length (a rolling 7-day lookback, not whatever
 * window_after_hours happened to be) -- comparing two raw totals across
 * differently-sized windows would show "drift" purely from the window
 * being longer or shorter, regardless of whether performance actually
 * changed. Normalizing by cycle count first (hours per single part,
 * averaged over however many cycles actually happened in each window)
 * makes the two windows genuinely comparable.
 */
function averageHoursPerCycle(result: WindowResult): number | null {
  if (result.status !== "ok" || result.summary.cycles <= 0) return null;
  return hoursToMakePart(result.summary) / result.summary.cycles;
}

/**
 * thresholdPercent: how much slower "current" has to be than the
 * original after-window before this counts as drifting rather than
 * normal noise. 15% is a deliberately loose bar -- this flags real
 * regression, not every small fluctuation in cycle time.
 */
export function assessDrift(
  originalAfter: WindowResult,
  current: WindowResult,
  thresholdPercent = 15,
): DriftAssessment {
  const originalHours = averageHoursPerCycle(originalAfter);
  const currentHours = averageHoursPerCycle(current);
  if (originalHours == null || currentHours == null || !(originalHours > 0)) {
    return {
      status: "insufficient_data",
      originalHoursPerPart: originalHours,
      currentHoursPerPart: currentHours,
      percentChange: null,
    };
  }
  const percentChange = ((currentHours - originalHours) / originalHours) * 100;
  return {
    status: percentChange > thresholdPercent ? "drifting" : "holding",
    originalHoursPerPart: originalHours,
    currentHoursPerPart: currentHours,
    percentChange,
  };
}
