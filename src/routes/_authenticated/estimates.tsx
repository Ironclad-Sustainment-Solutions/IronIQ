import { lazy, Suspense, useMemo, useState } from "react";
import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AlertTriangle, Loader2, Ruler, ShieldAlert } from "lucide-react";
import { PageHeader, Panel, EmptyState } from "@/components/ironiq/layout-primitives";

import { Tag } from "@/components/ironiq/badges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useApp } from "@/context/app-context";
import {
  useEstimatingParts,
  useGeometryRuns,
  useMachines,
  useMaterials,
  type EstimatingPart,
} from "@/lib/rfq-api";
import { submitGeometryAnalysis } from "@/lib/geometry.functions";
import { calculateEstimate } from "@/lib/estimating";
import {
  CONFIDENCE_LABELS,
  MACHINE_TYPE_LABELS,
  RFQ_STATUS_LABELS,
  currency,
  type EstimateConfidence,
  type GeometryResult,
} from "@/lib/rfq-domain";
import { meshUrlForFile } from "@/lib/part-models";
import { cn } from "@/lib/utils";

const ModelViewer = lazy(() => import("@/components/ironiq/model-viewer"));


export const Route = createFileRoute("/_authenticated/estimates")({
  head: () => ({
    meta: [
      { title: "Estimating Workspace — IronIQ" },
      {
        name: "description",
        content:
          "Rules-based CNC estimating: geometry analysis features and warnings prefill the full cost build-up, with the source and assumption behind every line.",
      },
      { property: "og:title", content: "Estimating Workspace — IronIQ" },
      {
        property: "og:description",
        content: "Geometry-driven cost build-up for machined part RFQs.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: EstimatesPage,
});

const confidenceToken: Record<EstimateConfidence, string> = {
  high: "success",
  moderate: "medium",
  low: "high",
  manual_required: "critical",
};

function EstimatesPage() {
  const { organization, facility, roles } = useApp();
  const internal = roles.some((r) => r === "ironiq_admin" || r === "consultant");
  const partsQuery = useEstimatingParts(organization?.id);
  const parts = partsQuery.data ?? [];
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = parts.find((p) => p.part.id === selectedId) ?? parts[0] ?? null;

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <PageHeader
        eyebrow="Manufacturing Services"
        title="Estimating"
        description="Geometry analysis output prefills every cost line. Each line shows the rate table, material record or geometry feature it came from, plus the assumption applied."
      />

      {!internal ? (
        <EmptyState message="Cost build-up, machine rates and margin are restricted to internal estimating staff." />
      ) : partsQuery.isLoading ? (
        <EmptyState message="Loading RFQ parts…" />
      ) : parts.length === 0 ? (
        <EmptyState message="No RFQ parts are awaiting an estimate for this organization." />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
          <nav className="space-y-2">
            {parts.map((item) => {
              const active = selected?.part.id === item.part.id;
              return (
                <button
                  key={item.part.id}
                  type="button"
                  onClick={() => setSelectedId(item.part.id)}
                  className={cn(
                    "w-full rounded-sm border px-3 py-3 text-left transition-colors",
                    active
                      ? "border-primary/60 bg-accent"
                      : "border-border hover:border-primary/40 hover:bg-accent/50",
                  )}
                >
                  <p className="text-sm font-medium text-foreground">
                    {item.part.part_number}
                    {item.part.revision ? ` rev ${item.part.revision}` : ""}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{item.rfq.rfq_number} · {item.rfq.title}</p>
                  <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                    {RFQ_STATUS_LABELS[item.rfq.status]} · Qty {item.part.quantity}
                  </p>
                </button>
              );
            })}
          </nav>

          {selected ? (
            <EstimateWorkspace key={selected.part.id} item={selected} facilityId={facility?.id} />
          ) : null}
        </div>
      )}
    </div>
  );
}

function EstimateWorkspace({ item, facilityId }: { item: EstimatingPart; facilityId?: string }) {
  const queryClient = useQueryClient();
  const runAnalysis = useServerFn(submitGeometryAnalysis);
  const runsQuery = useGeometryRuns(item.part.id);
  const machines = useMachines(facilityId).data ?? [];
  const materials = useMaterials().data ?? [];
  const [running, setRunning] = useState(false);
  const [machineOverride, setMachineOverride] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(item.part.quantity);
  const [margin, setMargin] = useState(35);
  const [programmingRate, setProgrammingRate] = useState(95);

  const latestRun = (runsQuery.data ?? []).find((r) => r.status === "complete") ?? null;
  const geometry: GeometryResult | null = latestRun?.result ?? null;
  const warnings = latestRun?.warnings ?? [];

  const model = item.files.find((f) => f.file_kind === "model_3d") ?? null;
  const drawing = item.files.find((f) => f.file_kind === "drawing") ?? null;
  const req = item.requirement;

  // Machine is prefilled from the geometry provider's suggested machine type.
  const suggestedMachine =
    machines.find((m) => m.machine_type === geometry?.suggested_machine_type) ??
    machines.find((m) => m.machine_type === req?.requested_machine_type) ??
    machines[0] ??
    null;
  const machine = machines.find((m) => m.id === machineOverride) ?? suggestedMachine;
  const material = materials.find((m) => m.id === req?.material_id) ?? null;

  const estimate = useMemo(
    () =>
      calculateEstimate({
        quantity,
        machine,
        material,
        geometry,
        stock: req
          ? { a: req.stock_dim_a, b: req.stock_dim_b, c: req.stock_dim_c, units: req.units }
          : null,
        customerSuppliedMaterial: req?.customer_supplied_material ?? false,
        hasDrawing: Boolean(drawing),
        hasModel: Boolean(model),
        criticalTolerances: req?.critical_tolerances ?? null,
        generalTolerance: req?.general_tolerance ?? null,
        heatTreatment: req?.heat_treatment ?? null,
        coating: req?.coating ?? null,
        faiRequired: req?.fai_required ?? false,
        materialCertification: req?.material_certification ?? false,
        specialPackaging: req?.special_packaging ?? null,
        expedite: (req?.requested_turnaround_days ?? 99) < 21,
        existingProgram: req?.existing_program ?? false,
        existingFixture: req?.existing_fixture ?? false,
        exportControlled: item.rfq.export_controlled || item.rfq.itar || item.rfq.cui,
        stockNote: req?.stock_shape ?? null,
        targetMargin: margin / 100,
        programmingRate,
      }),
    [quantity, machine, material, geometry, req, drawing, model, item.rfq, margin, programmingRate],
  );

  async function analyse() {
    if (!model) {
      toast.error("This part has no 3D model on file to analyse.");
      return;
    }
    setRunning(true);
    try {
      await runAnalysis({ data: { rfqPartId: item.part.id, rfqFileId: model.id } });
      await queryClient.invalidateQueries({ queryKey: ["geometry-runs", item.part.id] });
      toast.success("Geometry analysis complete — cost build-up refreshed.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Geometry analysis failed.");
    } finally {
      setRunning(false);
    }
  }

  const costLines = estimate.lines.filter((l) => l.category === "cost");
  const priceLines = estimate.lines.filter((l) => l.category === "price");

  const meshUrl = meshUrlForFile(model?.file_name);

  return (
    <div className="min-w-0 space-y-6">
      {meshUrl ? (
        <Panel
          title="3D model"
          subtitle={`${model?.file_name} · drag to orbit, scroll to zoom, right-drag to pan`}
        >
          <ClientOnly
            fallback={<div className="h-[380px] rounded-sm border border-border bg-card/40" />}
          >
            <Suspense
              fallback={<div className="h-[380px] rounded-sm border border-border bg-card/40" />}
            >
              <ModelViewer
                url={meshUrl}
                className="h-[380px] w-full overflow-hidden rounded-sm border border-border bg-[radial-gradient(circle_at_50%_35%,hsl(var(--accent)/0.35),transparent_70%)]"
              />
            </Suspense>
          </ClientOnly>
        </Panel>
      ) : null}

      <Panel
        title="Geometry analysis"
        subtitle={
          latestRun
            ? `${latestRun.provider} ${latestRun.provider_version} · ${new Date(latestRun.requested_at).toLocaleString()}`
            : "No analysis has been run for this part yet."
        }
        actions={
          <Button size="sm" onClick={() => void analyse()} disabled={running}>
            {running ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Ruler className="size-4" aria-hidden />}
            {latestRun ? "Re-run analysis" : "Run analysis"}
          </Button>
        }
      >
        {geometry ? (
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-4">
              <Metric label="Bounding box" value={`${geometry.bounding_box.x} × ${geometry.bounding_box.y} × ${geometry.bounding_box.z} ${geometry.bounding_box.units}`} />
              <Metric label="Volume" value={`${geometry.volume_in3} in³`} />
              <Metric label="Surface area" value={`${geometry.surface_area_in2} in²`} />
              <Metric label="Finished weight" value={`${geometry.estimated_finished_weight_lb} lb`} />
              <Metric label="Removal ratio" value={`${Math.round(geometry.material_removal_ratio * 100)}%`} />
              <Metric label="Holes / pockets / slots" value={`${geometry.hole_count} / ${geometry.pocket_count} / ${geometry.slot_count}`} />
              <Metric label="Undercuts" value={String(geometry.undercuts)} />
              <Metric label="Thin walls" value={geometry.thin_wall_indicator ? "Detected" : "None"} />
              <Metric label="Suggested setups" value={String(geometry.suggested_setups)} />
              <Metric label="Suggested machine" value={MACHINE_TYPE_LABELS[geometry.suggested_machine_type]} />
              <Metric label="Complexity score" value={`${geometry.complexity_score}/100`} />
              <Metric label="Uncertainty" value={`${Math.round((latestRun?.uncertainty ?? 0) * 100)}%`} />
            </div>

            {warnings.length > 0 ? (
              <ul className="space-y-2 rounded-sm border border-medium/40 bg-medium/10 p-4">
                {warnings.map((w) => (
                  <li key={w} className="flex gap-2 text-sm text-foreground">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0 text-medium" aria-hidden />
                    {w}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : (
          <EmptyState
            message={
              model
                ? `Run the analysis on ${model.file_name} to prefill setups, cycle time and tooling from the model.`
                : "Upload a 3D model for this part before running geometry analysis."
            }
          />
        )}
      </Panel>

      <Panel title="Estimating inputs" subtitle="Machine and material are prefilled from the analysis and the part requirements.">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label htmlFor="machine">Machine</Label>
            <Select
              value={machine?.id ?? ""}
              onValueChange={(v) => setMachineOverride(v)}
            >
              <SelectTrigger id="machine">
                <SelectValue placeholder="Select machine" />
              </SelectTrigger>
              <SelectContent>
                {machines.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.manufacturer} {m.model} — {MACHINE_TYPE_LABELS[m.machine_type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {geometry && machine?.machine_type === geometry.suggested_machine_type ? (
              <p className="text-[11px] text-muted-foreground">Matches the suggested machine type.</p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="qty">Quantity</Label>
            <Input
              id="qty"
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="margin">Target margin (%)</Label>
            <Input
              id="margin"
              type="number"
              min={0}
              max={85}
              value={margin}
              onChange={(e) => setMargin(Math.min(85, Math.max(0, Number(e.target.value) || 0)))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="progRate">Programming rate ($/h)</Label>
            <Input
              id="progRate"
              type="number"
              min={0}
              value={programmingRate}
              onChange={(e) => setProgrammingRate(Math.max(0, Number(e.target.value) || 0))}
            />
          </div>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-4">
          <Metric label="Material" value={material ? `${material.family} ${material.grade}` : req?.material_text ?? "Not identified"} />
          <Metric label="Programming hours" value={`${estimate.programmingHours} h`} />
          <Metric label="Setups" value={`${estimate.setupCount} (${estimate.setupHours} h)`} />
          <Metric label="Cycle time" value={`${estimate.cycleTimeMinutes} min/pc`} />
        </div>
      </Panel>

      <Panel
        title="Cost build-up"
        subtitle="Every line carries the source it was derived from and the assumption applied."
        actions={<Tag token={confidenceToken[estimate.confidence]}>{CONFIDENCE_LABELS[estimate.confidence]}</Tag>}
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="py-2 pr-4 eyebrow">Line</th>
                <th className="py-2 pr-4 eyebrow">Source</th>
                <th className="py-2 pr-4 eyebrow">Assumption</th>
                <th className="py-2 text-right eyebrow">Value</th>
              </tr>
            </thead>
            <tbody>
              {costLines.map((line) => (
                <tr key={line.line_key} className="border-b border-border/60 align-top">
                  <td className={cn("py-2.5 pr-4", line.line_key === "total_cost" && "font-semibold")}>
                    {line.label}
                  </td>
                  <td className="py-2.5 pr-4 text-xs text-muted-foreground">{line.source}</td>
                  <td className="py-2.5 pr-4 text-xs text-muted-foreground">{line.assumption}</td>
                  <td className={cn("py-2.5 text-right tabular-nums", line.line_key === "total_cost" && "font-semibold")}>
                    {currency(line.value)}
                  </td>
                </tr>
              ))}
              {priceLines.map((line) => (
                <tr key={line.line_key} className="border-b border-border/60 align-top">
                  <td className="py-2.5 pr-4 font-semibold">{line.label}</td>
                  <td className="py-2.5 pr-4 text-xs text-muted-foreground">{line.source}</td>
                  <td className="py-2.5 pr-4 text-xs text-muted-foreground">{line.assumption}</td>
                  <td className="py-2.5 text-right font-semibold tabular-nums">
                    {line.line_key === "target_margin"
                      ? `${Math.round(line.value * 100)}%`
                      : currency(line.value)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {(estimate.manualReviewReasons.length > 0 || estimate.assumptions.length > 0) && (
        <Panel title="Risk & review">
          {estimate.manualReviewReasons.length > 0 ? (
            <ul className="space-y-2">
              {estimate.manualReviewReasons.map((reason) => (
                <li key={reason} className="flex gap-2 text-sm text-foreground">
                  <ShieldAlert className="mt-0.5 size-4 shrink-0 text-critical" aria-hidden />
                  {reason}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No manual-review triggers on this estimate.</p>
          )}
          {estimate.assumptions.length > 0 ? (
            <ul className="mt-4 space-y-1.5 text-xs text-muted-foreground">
              {estimate.assumptions.map((a) => (
                <li key={a}>• {a}</li>
              ))}
            </ul>
          ) : null}
        </Panel>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="eyebrow">{label}</p>
      <p className="mt-1 truncate text-sm text-foreground">{value}</p>
    </div>
  );
}
