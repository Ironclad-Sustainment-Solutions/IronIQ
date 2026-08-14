/**
 * Server-only geometry analysis helpers.
 *
 * The external geometry provider is not connected yet, so `runProviderAnalysis`
 * returns a deterministic mock derived from the file name and size. When the
 * real service is wired in, only this function changes: it receives a
 * short-lived signed URL and must return the same structured result. The API
 * credential is read from the environment inside this module and never leaves
 * the server.
 */

import type { GeometryResult, MachineType } from "./rfq-domain";

export const GEOMETRY_PROVIDER = "ironiq-mock";
export const GEOMETRY_PROVIDER_VERSION = "0.1.0";

/** Small deterministic hash so the same file always yields the same mock. */
function hash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

const pick = <T,>(seed: number, options: T[]): T => options[seed % options.length]!;
const between = (seed: number, min: number, max: number, decimals = 2) => {
  const span = max - min;
  const v = min + ((seed % 1000) / 1000) * span;
  return Math.round(v * 10 ** decimals) / 10 ** decimals;
};

export interface ProviderRequest {
  signedUrl: string;
  fileName: string;
  fileSize: number;
  partId: string;
}

export interface ProviderResponse {
  result: GeometryResult;
  warnings: string[];
  uncertainty: number;
}

export async function runProviderAnalysis(req: ProviderRequest): Promise<ProviderResponse> {
  const seed = hash(`${req.fileName}:${req.fileSize}:${req.partId}`);
  const s = (n: number) => hash(`${seed}:${n}`);

  const x = between(s(1), 1.5, 14);
  const y = between(s(2), 1.5, 10);
  const z = between(s(3), 0.6, 6);
  const stockVolume = x * y * z;
  const removalRatio = between(s(4), 0.15, 0.85);
  const volume = Math.round(stockVolume * (1 - removalRatio) * 100) / 100;

  const holeCount = s(5) % 42;
  const pocketCount = s(6) % 9;
  const slotCount = s(7) % 6;
  const undercuts = s(8) % 10 === 0 ? 1 + (s(9) % 2) : 0;
  const thinWall = s(10) % 7 === 0;

  const suggestedMachine: MachineType =
    undercuts > 0 || (z > 4 && pocketCount > 5)
      ? "mill_5axis"
      : x / Math.max(y, 0.001) > 3 && y / Math.max(z, 0.001) < 1.4
        ? "lathe"
        : pick(s(11), ["mill_3axis", "mill_3axis", "mill_4axis"] as MachineType[]);

  const suggestedSetups =
    suggestedMachine === "mill_5axis" ? 2 : undercuts > 0 ? 3 : 1 + (s(12) % 2);

  const complexity = Math.min(
    100,
    Math.round(
      holeCount * 0.8 +
        pocketCount * 4 +
        slotCount * 3 +
        undercuts * 12 +
        removalRatio * 25 +
        (thinWall ? 10 : 0),
    ),
  );

  const warnings: string[] = [];
  if (thinWall) warnings.push("Thin-wall sections detected — distortion risk during machining.");
  if (undercuts > 0) warnings.push("Undercut geometry detected — special tooling may be required.");
  if (removalRatio > 0.75) warnings.push("High material removal ratio — cycle time is sensitive to stock size.");
  if (!/\.(step|stp|x_t|x_b|iges|igs|stl)$/i.test(req.fileName))
    warnings.push("Source file is not a recognised 3D model format — analysis is approximate.");

  const manualFlags: string[] = [];
  if (undercuts > 0) manualFlags.push("Undercuts detected.");
  if (thinWall) manualFlags.push("Thin walls detected.");
  if (complexity > 70) manualFlags.push("High geometry complexity score.");

  const result: GeometryResult = {
    bounding_box: { x, y, z, units: "in" },
    volume_in3: volume,
    surface_area_in2: Math.round(stockVolume * between(s(13), 1.8, 4.5) * 100) / 100,
    estimated_finished_weight_lb: Math.round(volume * 0.098 * 100) / 100,
    material_removal_ratio: removalRatio,
    hole_count: holeCount,
    pocket_count: pocketCount,
    slot_count: slotCount,
    undercuts,
    thin_wall_indicator: thinWall,
    suggested_setups: suggestedSetups,
    suggested_machine_type: suggestedMachine,
    complexity_score: complexity,
    manual_review_flags: manualFlags,
  };

  return {
    result,
    warnings,
    uncertainty: Math.round((0.08 + complexity / 400 + (thinWall ? 0.05 : 0)) * 100) / 100,
  };
}

/** Feature rows written alongside a completed run. */
export function featureRows(runId: string, result: GeometryResult) {
  return [
    { geometry_analysis_run_id: runId, feature_type: "hole", count: result.hole_count, detail: {} },
    { geometry_analysis_run_id: runId, feature_type: "pocket", count: result.pocket_count, detail: {} },
    { geometry_analysis_run_id: runId, feature_type: "slot", count: result.slot_count, detail: {} },
    {
      geometry_analysis_run_id: runId,
      feature_type: "undercut",
      count: result.undercuts,
      detail: { requires_special_tooling: result.undercuts > 0 },
    },
    {
      geometry_analysis_run_id: runId,
      feature_type: "thin_wall",
      count: result.thin_wall_indicator ? 1 : 0,
      detail: { indicator: result.thin_wall_indicator },
    },
  ];
}
