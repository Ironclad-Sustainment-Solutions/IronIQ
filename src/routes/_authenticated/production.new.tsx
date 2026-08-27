import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader, Panel } from "@/components/ironiq/layout-primitives";
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
import { createJob } from "@/lib/production-console.functions";
import { logJobEvent } from "@/lib/production-auth";
import { useApp } from "@/context/app-context";
import { useMachineProfiles } from "@/lib/production-api";
import { useProductionUser } from "@/lib/production-auth";
import { AI_STATEMENT } from "@/lib/workflow";

export const Route = createFileRoute("/_authenticated/production/new")({
  head: () => ({
    meta: [
      { title: "Submit CNC Job — IronIQ Production Flow" },
      {
        name: "description",
        content:
          "Submit part, material, machine, workholding, tooling and inspection data to start a CNC programming job in IronIQ.",
      },
      {
        property: "og:title",
        content: "Submit CNC Job — IronIQ Production Flow",
      },
      {
        property: "og:description",
        content: "Structured customer data submission for CNC programming.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NewJob,
});

const STEPS = ["Part", "Material & stock", "Machine", "Requirements"] as const;

function NewJob() {
  const navigate = useNavigate();
  const { organization, facility } = useApp();
  const user = useProductionUser();
  const { data: machines = [] } = useMachineProfiles(organization?.id);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    part_number: "",
    part_name: "",
    part_revision: "",
    quantity: "1",
    customer_job_number: "",
    requested_turnaround: "",
    material_spec: "",
    stock_type: "",
    stock_length: "",
    stock_width: "",
    stock_thickness: "",
    stock_diameter: "",
    machine_profile_id: "",
    machine_make: "",
    machine_model: "",
    controller: "",
    axis_count: "3",
    workholding_method: "",
    fixture_restrictions: "",
    available_tooling: "",
    critical_dimensions: "",
    geometric_tolerances: "",
    surface_finish_requirements: "",
    inspection_requirements: "",
    special_instructions: "",
  });

  const set = (key: keyof typeof form) => (value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const num = (v: string) => (v.trim() === "" ? null : Number(v));

  async function submit() {
    if (!organization?.id || !user) {
      toast.error("Select an organization first.");
      return;
    }
    if (!form.part_number.trim()) {
      toast.error("A part number is required.");
      setStep(0);
      return;
    }
    setSaving(true);
    const jobNumber = `JOB-${new Date().getFullYear()}-${Math.floor(Math.random() * 9000 + 1000)}`;
    const data = await createJob({
      data: {
        values: {
          organization_id: organization.id,
          facility_id: facility?.id ?? null,
          created_by: user.id,
          job_number: jobNumber,
          status: "customer_data_submitted",
          submitted_at: new Date().toISOString(),
          part_number: form.part_number,
          part_name: form.part_name || null,
          part_revision: form.part_revision || null,
          quantity: num(form.quantity),
          customer_job_number: form.customer_job_number || null,
          requested_turnaround: form.requested_turnaround || null,
          material_spec: form.material_spec || null,
          stock_type: form.stock_type || null,
          stock_length: num(form.stock_length),
          stock_width: num(form.stock_width),
          stock_thickness: num(form.stock_thickness),
          stock_diameter: num(form.stock_diameter),
          machine_profile_id: form.machine_profile_id || null,
          machine_make: form.machine_make || null,
          machine_model: form.machine_model || null,
          controller: form.controller || null,
          axis_count: num(form.axis_count),
          workholding_method: form.workholding_method || null,
          fixture_restrictions: form.fixture_restrictions || null,
          available_tooling: form.available_tooling || null,
          critical_dimensions: form.critical_dimensions || null,
          geometric_tolerances: form.geometric_tolerances || null,
          surface_finish_requirements: form.surface_finish_requirements || null,
          inspection_requirements: form.inspection_requirements || null,
          special_instructions: form.special_instructions || null,
        },
      },
    }).catch((e) => {
      toast.error(e instanceof Error ? e.message : "Could not submit the job.");
      return null;
    });
    setSaving(false);
    if (!data) {
      return;
    }
    await logJobEvent({
      data: {
        jobId: data.id,
        organizationId: organization.id,
        actorName: user.fullName,
        action: "Customer data submitted",
        detail: `${form.part_number} rev ${form.part_revision || "-"}`,
      },
    });
    toast.success(`${jobNumber} submitted for intake review.`);
    navigate({ to: "/production/jobs/$jobId", params: { jobId: data.id } });
  }

  return (
    <>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Production Flow"
          title="Submit CNC job"
          description="Structured intake — the more complete the data package, the fewer intake exceptions."
        />

        <p className="rounded-md border border-border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
          {AI_STATEMENT}
        </p>

        <div className="flex flex-wrap gap-2">
          {STEPS.map((label, i) => (
            <button
              key={label}
              type="button"
              onClick={() => setStep(i)}
              className={`rounded-md border px-3 py-1.5 text-xs uppercase tracking-wider ${
                i === step
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground"
              }`}
            >
              {i + 1}. {label}
            </button>
          ))}
        </div>

        <Panel title={STEPS[step]}>
          <div className="grid gap-4 md:grid-cols-2">
            {step === 0 && (
              <>
                <Field
                  label="Part number *"
                  value={form.part_number}
                  onChange={set("part_number")}
                />
                <Field
                  label="Part name"
                  value={form.part_name}
                  onChange={set("part_name")}
                />
                <Field
                  label="Revision"
                  value={form.part_revision}
                  onChange={set("part_revision")}
                />
                <Field
                  label="Quantity"
                  value={form.quantity}
                  onChange={set("quantity")}
                  type="number"
                />
                <Field
                  label="Customer job number"
                  value={form.customer_job_number}
                  onChange={set("customer_job_number")}
                />
                <Field
                  label="Requested turnaround"
                  value={form.requested_turnaround}
                  onChange={set("requested_turnaround")}
                />
              </>
            )}

            {step === 1 && (
              <>
                <Field
                  label="Material specification"
                  value={form.material_spec}
                  onChange={set("material_spec")}
                />
                <Field
                  label="Stock type"
                  value={form.stock_type}
                  onChange={set("stock_type")}
                />
                <Field
                  label="Stock length"
                  value={form.stock_length}
                  onChange={set("stock_length")}
                  type="number"
                />
                <Field
                  label="Stock width"
                  value={form.stock_width}
                  onChange={set("stock_width")}
                  type="number"
                />
                <Field
                  label="Stock thickness"
                  value={form.stock_thickness}
                  onChange={set("stock_thickness")}
                  type="number"
                />
                <Field
                  label="Stock diameter"
                  value={form.stock_diameter}
                  onChange={set("stock_diameter")}
                  type="number"
                />
              </>
            )}

            {step === 2 && (
              <>
                <div className="md:col-span-2">
                  <Label className="eyebrow">Approved machine profile</Label>
                  <Select
                    value={form.machine_profile_id}
                    onValueChange={(id) => {
                      const m = machines.find((x) => x.id === id);
                      setForm((prev) => ({
                        ...prev,
                        machine_profile_id: id,
                        machine_make: m?.make ?? prev.machine_make,
                        machine_model: m?.model ?? prev.machine_model,
                        controller: m?.controller ?? prev.controller,
                        axis_count: String(m?.axis_count ?? prev.axis_count),
                      }));
                    }}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select a machine profile" />
                    </SelectTrigger>
                    <SelectContent>
                      {machines.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.name} — {m.controller} ({m.axis_count} axis)
                          {m.is_supported ? "" : " — unsupported"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Field
                  label="Machine make"
                  value={form.machine_make}
                  onChange={set("machine_make")}
                />
                <Field
                  label="Machine model"
                  value={form.machine_model}
                  onChange={set("machine_model")}
                />
                <Field
                  label="Controller"
                  value={form.controller}
                  onChange={set("controller")}
                />
                <Field
                  label="Axis count"
                  value={form.axis_count}
                  onChange={set("axis_count")}
                  type="number"
                />
                <Field
                  label="Workholding method"
                  value={form.workholding_method}
                  onChange={set("workholding_method")}
                />
                <Field
                  label="Fixture restrictions"
                  value={form.fixture_restrictions}
                  onChange={set("fixture_restrictions")}
                />
              </>
            )}

            {step === 3 && (
              <>
                <Area
                  label="Available tooling"
                  value={form.available_tooling}
                  onChange={set("available_tooling")}
                />
                <Area
                  label="Critical dimensions"
                  value={form.critical_dimensions}
                  onChange={set("critical_dimensions")}
                />
                <Area
                  label="Geometric tolerances"
                  value={form.geometric_tolerances}
                  onChange={set("geometric_tolerances")}
                />
                <Area
                  label="Surface finish requirements"
                  value={form.surface_finish_requirements}
                  onChange={set("surface_finish_requirements")}
                />
                <Area
                  label="Inspection requirements"
                  value={form.inspection_requirements}
                  onChange={set("inspection_requirements")}
                />
                <Area
                  label="Special instructions"
                  value={form.special_instructions}
                  onChange={set("special_instructions")}
                />
              </>
            )}
          </div>

          <div className="mt-6 flex justify-between border-t border-border pt-4">
            <Button
              variant="outline"
              disabled={step === 0}
              onClick={() => setStep((s) => s - 1)}
            >
              Back
            </Button>
            {step < STEPS.length - 1 ? (
              <Button onClick={() => setStep((s) => s + 1)}>Continue</Button>
            ) : (
              <Button onClick={submit} disabled={saving}>
                {saving ? "Submitting…" : "Submit for intake review"}
              </Button>
            )}
          </div>
        </Panel>
      </div>
    </>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div>
      <Label className="eyebrow">{label}</Label>
      <Input
        className="mt-1"
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function Area({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <Label className="eyebrow">{label}</Label>
      <Textarea
        className="mt-1"
        rows={3}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
