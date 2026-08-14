/**
 * Transparent, rules-based estimating engine.
 *
 * Nothing here is model-generated: every line item is derived from the machine
 * rate table, the material library and the geometry analysis, and each carries
 * the source and assumption used to produce it. Authorised estimators may
 * override any value, but the override is recorded separately (see
 * `estimate_line_items.override_*`) and never rewrites the calculated value.
 */

import type {
  EstimateConfidence,
  GeometryResult,
  Machine,
  Material,
  MachineType,
} from "./rfq-domain";

export interface EstimateInput {
  quantity: number;
  machine: Machine | null;
  material: Material | null;
  geometry: GeometryResult | null;
  stock: { a: number | null; b: number | null; c: number | null; units: string } | null;
  customerSuppliedMaterial: boolean;
  hasDrawing: boolean;
  hasModel: boolean;
  criticalTolerances: string | null;
  generalTolerance: string | null;
  heatTreatment: string | null;
  coating: string | null;
  faiRequired: boolean;
  materialCertification: boolean;
  specialPackaging: string | null;
  expedite: boolean;
  existingProgram: boolean;
  existingFixture: boolean;
  exportControlled: boolean;
  stockNote?: string | null;
  targetMargin: number;
  programmingRate: number;
}

export interface CalculatedLine {
  line_key: string;
  label: string;
  category: "cost" | "price";
  value: number;
  source: string;
  assumption: string;
  sort_order: number;
}

export interface EstimateOutput {
  lines: CalculatedLine[];
  programmingHours: number;
  setupCount: number;
  setupHours: number;
  cycleTimeMinutes: number;
  totalCost: number;
  recommendedPrice: number;
  confidence: EstimateConfidence;
  manualReviewReasons: string[];
  assumptions: string[];
}

const round = (n: number, p = 2) => Math.round(n * 10 ** p) / 10 ** p;

const COMPLEX_MACHINES: MachineType[] = ["mill_5axis", "mill_turn"];

/** Baseline programming hours by machine type before material/complexity factors. */
const BASE_PROGRAMMING_HOURS: Record<MachineType, number> = {
  mill_3axis: 2.5,
  mill_4axis: 4,
  mill_5axis: 7,
  lathe: 2,
  mill_turn: 8,
  router: 2,
  edm: 3,
  grinding: 2,
  other: 3,
};

/** Baseline setup hours per setup by machine type. */
const BASE_SETUP_HOURS: Record<MachineType, number> = {
  mill_3axis: 1.0,
  mill_4axis: 1.5,
  mill_5axis: 2.0,
  lathe: 0.8,
  mill_turn: 2.2,
  router: 0.8,
  edm: 1.5,
  grinding: 1.0,
  other: 1.2,
};

const TIGHT_TOLERANCE = /0?\.000[0-5]|micron|\bIT[1-5]\b/i;
const SPECIAL_STOCK = /cast|forg/i;

export function calculateEstimate(input: EstimateInput): EstimateOutput {
  const reasons: string[] = [];
  const assumptions: string[] = [];
  const qty = Math.max(1, input.quantity || 1);
  const machineType: MachineType = input.machine?.machine_type ?? "mill_3axis";
  const burdenRate = input.machine?.hourly_burden_rate ?? 95;
  const setupRate = input.machine?.setup_labor_rate ?? 78;
  const progRate = input.programmingRate || 95;
  const geo = input.geometry;

  // ---- Stock volume and weight -------------------------------------------
  const stockVolume =
    input.stock?.a && input.stock?.b && input.stock?.c
      ? input.stock.a * input.stock.b * input.stock.c
      : geo
        ? geo.bounding_box.x * geo.bounding_box.y * geo.bounding_box.z * 1.15
        : 0;
  const density = input.material?.density_lb_in3 ?? 0.098;
  const stockWeight = stockVolume * density;
  const wasteFactor = input.material?.waste_factor ?? 0.15;

  if (!input.stock?.a) {
    assumptions.push(
      geo
        ? "Stock size assumed from the analysed bounding box plus 15% machining allowance."
        : "Stock size unknown — no geometry available; material cost is indicative only.",
    );
  }

  // ---- Material -----------------------------------------------------------
  const rawMaterialCost = input.customerSuppliedMaterial
    ? 0
    : stockWeight * (input.material?.cost_per_pound ?? 0);
  const wasteCost = rawMaterialCost * wasteFactor;
  const sawCost = input.customerSuppliedMaterial ? 12 : 18 + stockWeight * 0.25;

  // ---- Programming --------------------------------------------------------
  const complexity = geo ? Math.max(0.5, geo.complexity_score / 50) : 1;
  const progComplexity = input.material?.programming_complexity_factor ?? 1;
  const programmingHours = input.existingProgram
    ? round(BASE_PROGRAMMING_HOURS[machineType] * 0.25, 2)
    : round(BASE_PROGRAMMING_HOURS[machineType] * complexity * progComplexity, 2);
  const programmingCost = programmingHours * progRate;

  // ---- Setup --------------------------------------------------------------
  const setupCount = geo?.suggested_setups ?? (COMPLEX_MACHINES.includes(machineType) ? 2 : 1);
  const setupHours = round(setupCount * BASE_SETUP_HOURS[machineType], 2);
  const setupCost = setupHours * setupRate;

  // ---- Cycle time ---------------------------------------------------------
  const removalRatio = geo?.material_removal_ratio ?? 0.5;
  const featureMinutes = geo
    ? geo.hole_count * 0.6 + geo.pocket_count * 3.5 + geo.slot_count * 2.2 + geo.undercuts * 6
    : 12;
  const volumeMinutes = stockVolume * removalRatio * 0.9;
  const materialFactor = input.material?.cycle_time_factor ?? 1;
  const cycleTimeMinutes = round(
    Math.max(3, (featureMinutes + volumeMinutes) * materialFactor * (setupCount > 1 ? 1.1 : 1)),
    2,
  );
  const machineBurdenCost = (cycleTimeMinutes / 60) * burdenRate * qty;

  // ---- Tooling ------------------------------------------------------------
  const toolWear = input.material?.tool_wear_factor ?? 1;
  const toolingConsumption = round((cycleTimeMinutes / 60) * 9.5 * toolWear * qty, 2);
  const specialTooling = geo && geo.undercuts > 0 ? 240 : 0;
  const fixtureCost = input.existingFixture ? 0 : setupCount * 180;

  // ---- Quality, logistics, risk ------------------------------------------
  const inspectionCost =
    (input.faiRequired ? 240 : 60) +
    (input.materialCertification ? 45 : 0) +
    qty * (input.criticalTolerances ? 4.5 : 1.5);
  const outsideProcessing =
    (input.heatTreatment ? 120 + qty * 6 : 0) + (input.coating ? 95 + qty * 5 : 0);
  const packagingCost = (input.specialPackaging ? 85 : 25) + qty * 1.2;
  const freightCost = 65 + stockWeight * qty * 0.35;
  const expediteBase =
    rawMaterialCost + wasteCost + programmingCost + setupCost + machineBurdenCost;
  const expediteFee = input.expedite ? round(expediteBase * 0.18, 2) : 0;

  // ---- Confidence and manual review --------------------------------------
  if (!input.hasDrawing) reasons.push("No drawing supplied.");
  if (!input.hasModel) reasons.push("No 3D model supplied.");
  if (!input.material && !input.customerSuppliedMaterial) reasons.push("Material not identified.");
  if (input.criticalTolerances && TIGHT_TOLERANCE.test(input.criticalTolerances))
    reasons.push("Tight tolerances called out.");
  if (input.generalTolerance && TIGHT_TOLERANCE.test(input.generalTolerance))
    reasons.push("Tight general tolerance called out.");
  if (machineType === "mill_5axis") reasons.push("Five-axis work.");
  if (machineType === "mill_turn") reasons.push("Mill-turn work.");
  if (removalRatio > 0.75) reasons.push("High material removal ratio.");
  if (geo && geo.undercuts > 0) reasons.push("Undercuts detected.");
  if (geo && geo.thin_wall_indicator) reasons.push("Thin walls detected.");
  if (input.material?.specialty) reasons.push("Specialty material.");
  if (input.exportControlled) reasons.push("Export-controlled data.");
  if (!input.stock?.a && !geo) reasons.push("Stock size uncertain.");
  if (SPECIAL_STOCK.test(input.stockNote ?? "")) reasons.push("Casting or forging stock.");
  if (!geo) reasons.push("Geometry analysis incomplete.");
  if (geo?.manual_review_flags?.length) reasons.push(...geo.manual_review_flags);

  const uniqueReasons = Array.from(new Set(reasons));
  const confidence: EstimateConfidence =
    uniqueReasons.length === 0
      ? "high"
      : uniqueReasons.some((r) =>
            /No drawing|No 3D model|Material not identified|Geometry analysis incomplete|Export-controlled/i.test(
              r,
            ),
          )
        ? "manual_required"
        : uniqueReasons.length <= 2
          ? "moderate"
          : "low";

  const riskRate =
    confidence === "high"
      ? 0.03
      : confidence === "moderate"
        ? 0.06
        : confidence === "low"
          ? 0.1
          : 0.15;

  const preRiskCost =
    rawMaterialCost +
    wasteCost +
    sawCost +
    programmingCost +
    setupCost +
    machineBurdenCost +
    toolingConsumption +
    specialTooling +
    fixtureCost +
    inspectionCost +
    outsideProcessing +
    packagingCost +
    freightCost +
    expediteFee;
  const riskContingency = round(preRiskCost * riskRate, 2);
  const totalCost = round(preRiskCost + riskContingency, 2);
  const margin = Math.min(0.85, Math.max(0, input.targetMargin || 0.35));
  const recommendedPrice = round(totalCost / (1 - margin), 2);

  const rateSource = input.machine
    ? `Machine rate table — ${input.machine.manufacturer} ${input.machine.model}`
    : "Default shop rate (no machine selected)";
  const matSource = input.material
    ? `Material library — ${input.material.family} ${input.material.grade}`
    : "No material selected";
  const geoSource = geo ? "Geometry analysis run" : "No geometry analysis";

  const lines: CalculatedLine[] = [
    line(
      "raw_material",
      "Raw material",
      rawMaterialCost,
      matSource,
      input.customerSuppliedMaterial
        ? "Customer-supplied material — no raw material charge."
        : `${round(stockWeight, 2)} lb of stock at ${money(input.material?.cost_per_pound ?? 0)}/lb.`,
      1,
    ),
    line(
      "material_waste",
      "Material waste allowance",
      wasteCost,
      matSource,
      `${Math.round(wasteFactor * 100)}% standard waste factor from the material library.`,
      2,
    ),
    line(
      "stock_prep",
      "Saw / stock preparation",
      sawCost,
      "Standard shop stock-prep rule",
      "Flat handling charge plus $0.25/lb cut-off allowance.",
      3,
    ),
    line(
      "programming",
      "Programming",
      programmingCost,
      `${rateSource}; ${geoSource}`,
      `${programmingHours} h at ${money(progRate)}/h${input.existingProgram ? " (existing program reused — 75% reduction)" : ""}.`,
      4,
    ),
    line(
      "setup",
      "Setup",
      setupCost,
      rateSource,
      `${setupCount} setup(s) x ${BASE_SETUP_HOURS[machineType]} h at ${money(setupRate)}/h.`,
      5,
    ),
    line(
      "machine_burden",
      "Machine burden",
      machineBurdenCost,
      rateSource,
      `${cycleTimeMinutes} min cycle x ${qty} pc at ${money(burdenRate)}/h.`,
      6,
    ),
    line(
      "tooling_consumption",
      "Tooling consumption",
      toolingConsumption,
      "Tooling library wear model",
      `Cycle time x $9.50/h x ${toolWear} material tool-wear factor.`,
      7,
    ),
    line(
      "special_tooling",
      "Special tooling",
      specialTooling,
      "Geometry analysis",
      specialTooling ? "Undercuts require special-form tooling." : "No special tooling identified.",
      8,
    ),
    line(
      "fixture",
      "Fixture",
      fixtureCost,
      "Shop fixture rule",
      input.existingFixture
        ? "Existing fixture available — no charge."
        : `$180 per setup x ${setupCount}.`,
      9,
    ),
    line(
      "inspection",
      "Inspection",
      inspectionCost,
      "Inspection rule set",
      `${input.faiRequired ? "FAI required. " : ""}${input.materialCertification ? "Material certification. " : ""}Per-piece inspection allowance applied.`,
      10,
    ),
    line(
      "outside_processing",
      "Outside processing",
      outsideProcessing,
      "Requirements sheet",
      outsideProcessing
        ? "Heat treatment and/or coating routed outside."
        : "No outside processing required.",
      11,
    ),
    line(
      "packaging",
      "Packaging",
      packagingCost,
      "Standard packaging rule",
      input.specialPackaging ? "Special packaging requested." : "Standard packaging.",
      12,
    ),
    line(
      "freight",
      "Freight",
      freightCost,
      "Freight estimate rule",
      "Flat $65 plus $0.35/lb shipped weight.",
      13,
    ),
    line(
      "expedite",
      "Expedite fee",
      expediteFee,
      "Requested turnaround",
      input.expedite ? "18% expedite premium on direct cost." : "Standard lead time — no expedite fee.",
      14,
    ),
    line(
      "risk_contingency",
      "Risk contingency",
      riskContingency,
      `Confidence: ${confidence}`,
      `${Math.round(riskRate * 100)}% contingency driven by the confidence rating.`,
      15,
    ),
    line(
      "total_cost",
      "Estimated total cost",
      totalCost,
      "Sum of cost lines above",
      "All cost lines including contingency.",
      16,
    ),
    {
      line_key: "target_margin",
      label: "Target gross margin",
      category: "price",
      value: margin,
      source: "Estimator setting",
      assumption: `${Math.round(margin * 100)}% target gross margin.`,
      sort_order: 17,
    },
    {
      line_key: "recommended_price",
      label: "Recommended selling price",
      category: "price",
      value: recommendedPrice,
      source: "Total cost / (1 - margin)",
      assumption: `${money(totalCost)} cost at ${Math.round(margin * 100)}% margin.`,
      sort_order: 18,
    },
  ];

  return {
    lines,
    programmingHours,
    setupCount,
    setupHours,
    cycleTimeMinutes,
    totalCost,
    recommendedPrice,
    confidence,
    manualReviewReasons: uniqueReasons,
    assumptions,
  };
}

function line(
  key: string,
  label: string,
  value: number,
  source: string,
  assumption: string,
  order: number,
): CalculatedLine {
  return {
    line_key: key,
    label,
    category: "cost",
    value: round(value, 2),
    source,
    assumption,
    sort_order: order,
  };
}

function money(v: number) {
  return v.toLocaleString("en-US", { style: "currency", currency: "USD" });
}
