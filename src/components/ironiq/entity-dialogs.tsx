import { cloneElement, isValidElement, useEffect, useId, useState, type ReactElement, type ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FINDING_STATUS_LABELS,
  type Facility,
  type Finding,
  type FindingStatus,
  type ImprovementProject,
  type Organization,
} from "@/lib/domain";
import {
  useSaveFacility,
  useSaveOrganization,
  useToggleProjectFinding,
  useUpdateFinding,
  type FacilityInput,
  type OrganizationInput,
} from "@/lib/mutations";

function Field({ label, children }: { label: string; children: ReactNode }) {
  const id = useId();
  const control = isValidElement(children)
    ? cloneElement(children as ReactElement<{ id?: string }>, { id })
    : children;
  return (
    <div className="space-y-1.5">
      <Label className="eyebrow" htmlFor={id}>
        {label}
      </Label>
      {control}
    </div>
  );
}

export function OrganizationDialog({
  organization,
  trigger,
}: {
  organization?: Organization;
  trigger: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const save = useSaveOrganization();
  const [form, setForm] = useState<OrganizationInput>({ name: "" });

  useEffect(() => {
    if (!open) return;
    setForm(
      organization
        ? {
            id: organization.id,
            name: organization.name,
            industry: organization.industry,
            headquarters: organization.headquarters,
            primary_contact_name: organization.primary_contact_name,
            primary_contact_email: organization.primary_contact_email,
            primary_contact_phone: organization.primary_contact_phone,
          }
        : { name: "" },
    );
  }, [open, organization]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{organization ? "Edit organization" : "New organization"}</DialogTitle>
          <DialogDescription>
            Client record used to scope facilities, assessments and access.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Name">
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </Field>
          </div>
          <Field label="Industry">
            <Input
              value={form.industry ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, industry: e.target.value }))}
            />
          </Field>
          <Field label="Headquarters">
            <Input
              value={form.headquarters ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, headquarters: e.target.value }))}
            />
          </Field>
          <Field label="Primary contact">
            <Input
              value={form.primary_contact_name ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, primary_contact_name: e.target.value }))}
            />
          </Field>
          <Field label="Contact email">
            <Input
              type="email"
              value={form.primary_contact_email ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, primary_contact_email: e.target.value }))}
            />
          </Field>
        </div>
        <DialogFooter>
          <Button
            disabled={save.isPending}
            onClick={() => save.mutate(form, { onSuccess: () => setOpen(false) })}
          >
            Save organization
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function FacilityDialog({
  facility,
  organizationId,
  trigger,
}: {
  facility?: Facility;
  organizationId: string;
  trigger: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const save = useSaveFacility();
  const [form, setForm] = useState<FacilityInput>({ organization_id: organizationId, name: "" });

  useEffect(() => {
    if (!open) return;
    setForm(
      facility
        ? {
            id: facility.id,
            organization_id: facility.organization_id,
            name: facility.name,
            address: facility.address,
            primary_products: facility.primary_products,
            primary_processes: facility.primary_processes,
            machine_count: facility.machine_count,
            employee_count: facility.employee_count,
            operating_shifts: facility.operating_shifts,
            primary_contact_name: facility.primary_contact_name,
            primary_contact_email: facility.primary_contact_email,
          }
        : { organization_id: organizationId, name: "" },
    );
  }, [open, facility, organizationId]);

  const num = (v: string) => (v === "" ? null : Number(v));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{facility ? "Edit facility" : "New facility"}</DialogTitle>
          <DialogDescription>Plant profile used to scope and interpret assessments.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Name">
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Address">
              <Input
                value={form.address ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              />
            </Field>
          </div>
          <Field label="Primary products">
            <Input
              value={form.primary_products ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, primary_products: e.target.value }))}
            />
          </Field>
          <Field label="Primary processes">
            <Input
              value={form.primary_processes ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, primary_processes: e.target.value }))}
            />
          </Field>
          <Field label="Machines">
            <Input
              type="number"
              value={form.machine_count ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, machine_count: num(e.target.value) }))}
            />
          </Field>
          <Field label="Employees">
            <Input
              type="number"
              value={form.employee_count ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, employee_count: num(e.target.value) }))}
            />
          </Field>
          <Field label="Shifts">
            <Input
              type="number"
              value={form.operating_shifts ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, operating_shifts: num(e.target.value) }))}
            />
          </Field>
          <Field label="Site contact">
            <Input
              value={form.primary_contact_name ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, primary_contact_name: e.target.value }))}
            />
          </Field>
        </div>
        <DialogFooter>
          <Button
            disabled={save.isPending}
            onClick={() => save.mutate(form, { onSuccess: () => setOpen(false) })}
          >
            Save facility
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const FINDING_STATUSES = Object.keys(FINDING_STATUS_LABELS) as FindingStatus[];

export function FindingDialog({ finding, trigger }: { finding: Finding; trigger: ReactNode }) {
  const [open, setOpen] = useState(false);
  const update = useUpdateFinding();
  const [form, setForm] = useState({
    assigned_owner: finding.assigned_owner ?? "",
    target_date: finding.target_date ?? "",
    status: finding.status as FindingStatus,
    closure_evidence: finding.closure_evidence ?? "",
    verified_by: finding.verified_by ?? "",
    verification_date: finding.verification_date ?? "",
  });

  useEffect(() => {
    if (!open) return;
    setForm({
      assigned_owner: finding.assigned_owner ?? "",
      target_date: finding.target_date ?? "",
      status: finding.status,
      closure_evidence: finding.closure_evidence ?? "",
      verified_by: finding.verified_by ?? "",
      verification_date: finding.verification_date ?? "",
    });
  }, [open, finding]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Manage finding {finding.finding_code ?? ""}</DialogTitle>
          <DialogDescription>Assign an owner, track progress and verify closure.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Assigned owner">
            <Input
              value={form.assigned_owner}
              onChange={(e) => setForm((f) => ({ ...f, assigned_owner: e.target.value }))}
            />
          </Field>
          <Field label="Target date">
            <Input
              type="date"
              value={form.target_date}
              onChange={(e) => setForm((f) => ({ ...f, target_date: e.target.value }))}
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Status">
              <Select
                value={form.status}
                onValueChange={(v) => setForm((f) => ({ ...f, status: v as FindingStatus }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FINDING_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {FINDING_STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Closure evidence">
              <Textarea
                rows={3}
                value={form.closure_evidence}
                onChange={(e) => setForm((f) => ({ ...f, closure_evidence: e.target.value }))}
              />
            </Field>
          </div>
          <Field label="Verified by">
            <Input
              value={form.verified_by}
              onChange={(e) => setForm((f) => ({ ...f, verified_by: e.target.value }))}
            />
          </Field>
          <Field label="Verification date">
            <Input
              type="date"
              value={form.verification_date}
              onChange={(e) => setForm((f) => ({ ...f, verification_date: e.target.value }))}
            />
          </Field>
        </div>
        <DialogFooter>
          <Button
            disabled={update.isPending}
            onClick={() =>
              update.mutate(
                {
                  id: finding.id,
                  values: {
                    assigned_owner: form.assigned_owner || null,
                    target_date: form.target_date || null,
                    status: form.status,
                    closure_evidence: form.closure_evidence || null,
                    verified_by: form.verified_by || null,
                    verification_date: form.verification_date || null,
                  },
                },
                { onSuccess: () => setOpen(false) },
              )
            }
          >
            Save finding
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ProjectFindingsDialog({
  project,
  findings,
  linkedFindingIds,
  trigger,
}: {
  project: ImprovementProject;
  findings: Finding[];
  linkedFindingIds: string[];
  trigger: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const toggle = useToggleProjectFinding();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Linked findings</DialogTitle>
          <DialogDescription>
            Connect this project to the readiness gaps it is intended to close.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[50vh] space-y-3 overflow-y-auto pr-1">
          {findings.length === 0 ? (
            <p className="text-sm text-muted-foreground">No findings available for this facility.</p>
          ) : (
            findings.map((f) => {
              const linked = linkedFindingIds.includes(f.id);
              return (
                <label key={f.id} className="flex items-start gap-3 text-sm">
                  <Checkbox
                    checked={linked}
                    disabled={toggle.isPending}
                    onCheckedChange={() =>
                      toggle.mutate({ project, findingId: f.id, linked })
                    }
                  />
                  <span>
                    <span className="metric mr-2 text-xs text-muted-foreground">
                      {f.finding_code ?? "—"}
                    </span>
                    {f.description}
                  </span>
                </label>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
