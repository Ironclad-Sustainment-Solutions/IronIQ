import mb4471 from "@/assets/models/MB-4471_revC.stl.asset.json";

/**
 * Web-ready tessellated meshes for uploaded CAD models, keyed by the
 * rfq_files.file_name of the source STEP/model record. Browser-safe module:
 * contains no three.js imports so SSR routes can read it freely.
 */
const MESHES: Record<string, string> = {
  "MB-4471_revC.step": mb4471.url,
};

export function meshUrlForFile(fileName: string | null | undefined): string | null {
  if (!fileName) return null;
  return MESHES[fileName] ?? null;
}
