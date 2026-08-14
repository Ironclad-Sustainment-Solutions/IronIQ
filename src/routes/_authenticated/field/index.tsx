import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ClipboardList, Plus, Trash2 } from "lucide-react";
import { PageHeader, Panel, EmptyState } from "@/components/ironiq/layout-primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApp } from "@/context/app-context";
import {
  useCreateFieldAssessment,
  useDeleteFieldAssessment,
  useFieldAssessments,
} from "@/lib/field-assessment-api";
import { SHIFTS } from "@/lib/field-assessment";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/field/")({
  head: () => ({
    meta: [
      { title: "Field Assessment — IronIQ" },
      {
        name: "description",
        content:
          "Capture shop-floor capability observations on the fly and produce an instant capability score for any cell, work center or shift.",
      },
      { property: "og:title", content: "Field Assessment — IronIQ" },
      {
        property: "og:description",
        content: "Mobile-first shop-floor capability capture with an instant score.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FieldIndex,
});

function FieldIndex() {
  const { organization, facility, profile } = useApp();
  const navigate = useNavigate();
  const list = useFieldAssessments(organization?.id, facility?.id).data ?? [];
  const create = useCreateFieldAssessment();
  const remove = useDeleteFieldAssessment();

  const [area, setArea] = useState("");
  const [workCenter, setWorkCenter] = useState("");
  const [shift, setShift] = useState<string>("1st");

  const start = () => {
    if (!organization?.id) return;
    create.mutate(
      {
        organization_id: organization.id,
        facility_id: facility?.id ?? null,
        area,
        work_center: workCenter,
        shift,
        observer_name: profile?.full_name ?? null,
      },
      {
        onSuccess: (id) => navigate({ to: "/field/$fieldId", params: { fieldId: id } }),
      },
    );
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        eyebrow={facility?.name ?? organization?.name ?? "IronIQ"}
        title="Field Assessment"
        description="Walk the floor, record what you see across 12 capability areas, and leave with a preliminary field baseline."
      />

      <Panel title="Start a walk" subtitle="Two taps to begin — everything else saves as you go">
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="fa-area">Area / cell</Label>
            <Input
              id="fa-area"
              value={area}
              maxLength={120}
              onChange={(e) => setArea(e.target.value)}
              placeholder="e.g. Cell 4 — Horizontal Mills"
              className="h-12 text-base"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="fa-wc">Work center (optional)</Label>
              <Input
                id="fa-wc"
                value={workCenter}
                maxLength={120}
                onChange={(e) => setWorkCenter(e.target.value)}
                placeholder="HMC-02"
                className="h-12 text-base"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Shift</Label>
              <div className="grid grid-cols-4 gap-1.5">
                {SHIFTS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setShift(s)}
                    className={cn(
                      "h-12 rounded-sm border font-display text-xs font-semibold uppercase tracking-widest transition-colors",
                      shift === s
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border text-muted-foreground hover:border-primary/60 hover:text-foreground",
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <Button
            size="lg"
            className="h-12 w-full sm:w-auto"
            disabled={!organization?.id || create.isPending}
            onClick={start}
          >
            <Plus className="size-4" aria-hidden /> Start field assessment
          </Button>
        </div>
      </Panel>

      <Panel title="Recent walks" subtitle={`${list.length} recorded`}>
        {list.length === 0 ? (
          <EmptyState message="No field assessments captured yet." />
        ) : (
          <ul className="divide-y divide-border">
            {list.map((f) => (
              <li key={f.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3">
                <Link
                  to="/field/$fieldId"
                  params={{ fieldId: f.id }}
                  className="min-w-0 outline-none focus-visible:underline"
                >
                  <p className="truncate text-sm font-medium text-foreground">
                    {f.area || "Untitled area"}
                    {f.work_center ? <span className="text-muted-foreground"> · {f.work_center}</span> : null}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {new Date(f.observed_at).toLocaleString()} · {f.shift ?? "—"} shift ·{" "}
                    {f.status === "submitted" ? "Submitted" : "Open"}
                  </p>
                </Link>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="metric text-lg font-semibold text-foreground">
                    {f.capability_score === null ? "—" : `${Math.round(Number(f.capability_score))}%`}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Delete field assessment for ${f.area}`}
                    onClick={() => remove.mutate(f.id)}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <ClipboardList className="size-3.5 shrink-0" aria-hidden />
        A field walk records qualitative status across 12 capability areas, so it can be escalated
        into a formal capability assessment later — it never produces a score.

      </p>
    </div>
  );
}
