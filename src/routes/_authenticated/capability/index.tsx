import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader, Panel, EmptyState } from "@/components/ironiq/layout-primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tag } from "@/components/ironiq/badges";
import { useApp } from "@/context/app-context";
import { useCapAssessments, useCreateCapAssessment } from "@/lib/capability-api";
import { CAP_STATUS_LABELS, type CapAssessmentStatus } from "@/lib/capability-domain";
import { ScoreChip } from "@/components/ironiq/capability/shared";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/capability/")({
  head: () => ({
    meta: [
      { title: "Capability Assessments — IronIQ" },
      {
        name: "description",
        content:
          "Performance-based manufacturing capability assessments: identify constraints, validate root capability gaps, restore and sustain performance.",
      },
      { property: "og:title", content: "Capability Assessments — IronIQ" },
      {
        property: "og:description",
        content: "Performance-based manufacturing capability assessment by Ironclad Sustainment Solutions.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CapabilityIndex,
});

const statusToken: Record<CapAssessmentStatus, "steel" | "primary" | "medium" | "success" | "high"> = {
  draft: "steel",
  intake: "medium",
  in_progress: "primary",
  review: "medium",
  finalized: "success",
  reopened: "high",
};

function CapabilityIndex() {
  const { organization, facilities, organizations, can } = useApp();
  const assessments = useCapAssessments(organization?.id);
  const create = useCreateCapAssessment();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", facility_id: "", lead_assessor: "", scope: "" });

  const editable = can("conduct_assessment");

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Ironclad Sustainment Solutions"
        title="Performance-Based Capability Assessment"
        description="Can this operation consistently produce the required output, at the required quality, rate, cost and delivery performance — and sustain that capability?"
        actions={
          editable ? (
            <Button onClick={() => setOpen((o) => !o)}>
              <Plus className="size-4" /> New assessment
            </Button>
          ) : null
        }
      />

      {open ? (
        <Panel title="New Capability Assessment">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <span className="eyebrow">Assessment name</span>
              <Input
                className="mt-1.5"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Q3 Capability Review — Machining Cell 2"
              />
            </div>
            <div>
              <span className="eyebrow">Facility</span>
              <Select value={form.facility_id} onValueChange={(v) => setForm((f) => ({ ...f, facility_id: v }))}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="Select facility" />
                </SelectTrigger>
                <SelectContent>
                  {facilities.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <span className="eyebrow">Lead assessor</span>
              <Input
                className="mt-1.5"
                value={form.lead_assessor}
                onChange={(e) => setForm((f) => ({ ...f, lead_assessor: e.target.value }))}
              />
            </div>
            <div>
              <span className="eyebrow">Scope</span>
              <Textarea
                className="mt-1.5 min-h-16"
                value={form.scope}
                onChange={(e) => setForm((f) => ({ ...f, scope: e.target.value }))}
              />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button
              disabled={create.isPending || !organization}
              onClick={() =>
                create.mutate(
                  {
                    organization_id: organization?.id ?? "",
                    facility_id: form.facility_id || null,
                    name: form.name,
                    lead_assessor: form.lead_assessor || null,
                    scope: form.scope || null,
                  },
                  {
                    onSuccess: (id) => {
                      setOpen(false);
                      setForm({ name: "", facility_id: "", lead_assessor: "", scope: "" });
                      void navigate({ to: "/capability/$assessmentId", params: { assessmentId: id } });
                    },
                  },
                )
              }
            >
              Create
            </Button>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
          {organizations.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">Create an organization first.</p>
          ) : null}
        </Panel>
      ) : null}

      <Panel title="Assessments" subtitle={organization ? organization.name : "Select an organization"}>
        {assessments.isLoading ? (
          <EmptyState message="Loading…" />
        ) : (assessments.data ?? []).length === 0 ? (
          <EmptyState message="No capability assessments yet. Start with the customer problem intake." />
        ) : (
          <ul className="divide-y divide-border">
            {(assessments.data ?? []).map((a) => (
              <li key={a.id}>
                <Link
                  to="/capability/$assessmentId"
                  params={{ assessmentId: a.id }}
                  className="flex flex-wrap items-center gap-3 py-3 hover:bg-muted/40"
                >
                  <span className="min-w-48 flex-1 text-sm font-medium text-foreground">{a.name}</span>
                  <span className="text-xs text-muted-foreground">{a.assessment_date}</span>
                  <Tag token={statusToken[a.status]}>{CAP_STATUS_LABELS[a.status]}</Tag>
                  <ScoreChip score={a.overall_score === null ? null : Number(a.overall_score)} size="sm" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
