import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageHeader, Panel } from "@/components/ironiq/layout-primitives";
import { useApp } from "@/context/app-context";
import { useTemplates } from "@/lib/api";
import { selectableTemplateVersions } from "@/lib/template-validation";

import { logAudit } from "@/lib/api";
import { createAssessment } from "@/lib/api.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/assessments/new")({
  head: () => ({
    meta: [
      { title: "New Assessment — IronIQ" },
      {
        name: "description",
        content: "Scope and launch a new manufacturing readiness assessment against a published template version.",
      },
      { property: "og:title", content: "New Assessment — IronIQ" },
      { property: "og:description", content: "Scope and launch a manufacturing readiness assessment." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: NewAssessment,
});

const TYPES = [
  { value: "baseline", label: "Baseline" },
  { value: "follow_up", label: "Follow-up" },
  { value: "pre_award", label: "Pre-award" },
  { value: "surveillance", label: "Surveillance" },
];

function NewAssessment() {
  const { facility, organization, profile } = useApp();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data } = useTemplates();

  // Archived templates must never be selectable for a new assessment.
  const published = selectableTemplateVersions(data?.templates ?? [], data?.versions ?? []);
  const templateName = (id: string) => {
    const template = data?.templates.find(
      (t) => t.id === data.versions.find((v) => v.id === id)?.template_id,
    );
    return template ? `${template.template_code ? `${template.template_code} · ` : ""}${template.name}` : "Template";
  };


  const [form, setForm] = useState({
    name: "",
    assessment_type: "baseline",
    assessment_date: new Date().toISOString().slice(0, 10),
    template_version_id: "",
    lead_assessor: "",
    production_area: "",
    product_family: "",
    scope: "",
  });

  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const create = useMutation({
    mutationFn: async () => {
      if (!facility || !organization) throw new Error("Select a facility first");
      if (!form.template_version_id) throw new Error("Choose a template version");
      const inserted = await createAssessment({
        data: {
          organization_id: organization.id,
          facility_id: facility.id,
          template_version_id: form.template_version_id,
          name: form.name,
          assessment_type: form.assessment_type,
          assessment_date: form.assessment_date,
          lead_assessor: form.lead_assessor || (profile?.full_name ?? null),
          production_area: form.production_area || null,
          product_family: form.product_family || null,
          scope: form.scope || null,
        },
      });
      await logAudit({
        organization_id: organization.id,
        facility_id: facility.id,
        actor_name: profile?.full_name ?? null,
        action: "assessment.created",
        entity_type: "assessment",
        entity_id: (inserted as { id: string }).id,
        details: { name: form.name, type: form.assessment_type },
      });
      return inserted as { id: string };
    },
    onSuccess: (row) => {
      queryClient.invalidateQueries({ queryKey: ["assessments"] });
      queryClient.invalidateQueries({ queryKey: ["audit-log"] });
      toast.success("Assessment created");
      navigate({ to: "/assessments/$assessmentId", params: { assessmentId: row.id } });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not create assessment"),
  });

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader
        eyebrow={facility?.name ?? "Facility"}
        title="New Assessment"
        description="Define the scope, assessment window and template version. Questions are pulled from the selected published template."
      />

      <Panel title="Assessment setup">
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="name">Assessment name</Label>
            <Input
              id="name"
              required
              value={form.name}
              onChange={(e) => set("name")(e.target.value)}
              placeholder="Plant 4 — Q4 Readiness Assessment"
            />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Assessment type</Label>
              <Select value={form.assessment_type} onValueChange={set("assessment_type")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="date">Assessment date</Label>
              <Input
                id="date"
                type="date"
                value={form.assessment_date}
                onChange={(e) => set("assessment_date")(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Template version</Label>
            <Select value={form.template_version_id} onValueChange={set("template_version_id")}>
              <SelectTrigger>
                <SelectValue placeholder="Select a published template version" />
              </SelectTrigger>
              <SelectContent>
                {published.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {templateName(v.id)} — v{v.version}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="lead">Lead assessor</Label>
              <Input
                id="lead"
                value={form.lead_assessor}
                onChange={(e) => set("lead_assessor")(e.target.value)}
                placeholder={profile?.full_name ?? "Name"}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="area">Production area</Label>
              <Input
                id="area"
                value={form.production_area}
                onChange={(e) => set("production_area")(e.target.value)}
                placeholder="Machining Cell 3"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="family">Product family</Label>
            <Input
              id="family"
              value={form.product_family}
              onChange={(e) => set("product_family")(e.target.value)}
              placeholder="Aluminium housings"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="scope">Scope statement</Label>
            <Textarea
              id="scope"
              rows={4}
              value={form.scope}
              onChange={(e) => set("scope")(e.target.value)}
              placeholder="Processes, lines, shifts and product families covered by this assessment."
            />
          </div>

          <div className="flex justify-end gap-2 border-t border-border pt-5">
            <Button type="button" variant="outline" onClick={() => navigate({ to: "/assessments" })}>
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending}>
              Create and start scoring
            </Button>
          </div>
        </form>
      </Panel>
    </div>
  );
}
