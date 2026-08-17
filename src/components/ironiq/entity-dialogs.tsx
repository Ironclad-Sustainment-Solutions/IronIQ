import {
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
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
  PROJECT_STATUS_LABELS,
  SEVERITY_ORDER,
  type CorrectiveAction,
  type Facility,
  type Finding,
  type FindingSeverity,
  type FindingStatus,
  type ImprovementProject,
  type Organization,
  type ProjectStatus,
} from "@/lib/domain";
import {
  useSaveFacility,
  useSaveOrganization,
  useSaveCorrectiveAction,
  useSaveImprovementProject,
  useToggleProjectFinding,
  useUpdateFinding,
  type FacilityInput,
  type OrganizationInput,
} from "@/lib/mutations";
import { useFindings } from "@/lib/api";
import { useDraftFromPrecedent } from "@/lib/precedent-draft-api";
import { toast } from "sonner";

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
          <DialogTitle>
            {organization ? "Edit organization" : "New organization"}
          </DialogTitle>
          <DialogDescription>
            Client record used to scope facilities, assessments and access.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Name">
              <Input
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
              />
            </Field>
          </div>
          <Field label="Industry">
            <Input
              value={form.industry ?? ""}
              onChange={(e) =>
                setForm((f) => ({ ...f, industry: e.target.value }))
              }
            />
          </Field>
          <Field label="Headquarters">
            <Input
              value={form.headquarters ?? ""}
              onChange={(e) =>
                setForm((f) => ({ ...f, headquarters: e.target.value }))
              }
            />
          </Field>
          <Field label="Primary contact">
            <Input
              value={form.primary_contact_name ?? ""}
              onChange={(e) =>
                setForm((f) => ({ ...f, primary_contact_name: e.target.value }))
              }
            />
          </Field>
          <Field label="Contact email">
            <Input
              type="email"
              value={form.primary_contact_email ?? ""}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  primary_contact_email: e.target.value,
                }))
              }
            />
          </Field>
        </div>
        <DialogFooter>
          <Button
            disabled={save.isPending}
            onClick={() =>
              save.mutate(form, { onSuccess: () => setOpen(false) })
            }
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
  const [form, setForm] = useState<FacilityInput>({
    organization_id: organizationId,
    name: "",
  });

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
          <DialogTitle>
            {facility ? "Edit facility" : "New facility"}
          </DialogTitle>
          <DialogDescription>
            Plant profile used to scope and interpret assessments.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Name">
              <Input
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
              />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Address">
              <Input
                value={form.address ?? ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, address: e.target.value }))
                }
              />
            </Field>
          </div>
          <Field label="Primary products">
            <Input
              value={form.primary_products ?? ""}
              onChange={(e) =>
                setForm((f) => ({ ...f, primary_products: e.target.value }))
              }
            />
          </Field>
          <Field label="Primary processes">
            <Input
              value={form.primary_processes ?? ""}
              onChange={(e) =>
                setForm((f) => ({ ...f, primary_processes: e.target.value }))
              }
            />
          </Field>
          <Field label="Machines">
            <Input
              type="number"
              value={form.machine_count ?? ""}
              onChange={(e) =>
                setForm((f) => ({ ...f, machine_count: num(e.target.value) }))
              }
            />
          </Field>
          <Field label="Employees">
            <Input
              type="number"
              value={form.employee_count ?? ""}
              onChange={(e) =>
                setForm((f) => ({ ...f, employee_count: num(e.target.value) }))
              }
            />
          </Field>
          <Field label="Shifts">
            <Input
              type="number"
              value={form.operating_shifts ?? ""}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  operating_shifts: num(e.target.value),
                }))
              }
            />
          </Field>
          <Field label="Site contact">
            <Input
              value={form.primary_contact_name ?? ""}
              onChange={(e) =>
                setForm((f) => ({ ...f, primary_contact_name: e.target.value }))
              }
            />
          </Field>
        </div>
        <DialogFooter>
          <Button
            disabled={save.isPending}
            onClick={() =>
              save.mutate(form, { onSuccess: () => setOpen(false) })
            }
          >
            Save facility
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const FINDING_STATUSES = Object.keys(FINDING_STATUS_LABELS) as FindingStatus[];

export function FindingDialog({
  finding,
  trigger,
}: {
  finding: Finding;
  trigger: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const update = useUpdateFinding();
  const [form, setForm] = useState({
    description: finding.description,
    severity: finding.severity,
    category_name: finding.category_name ?? "",
    root_cause: finding.root_cause ?? "",
    recommended_action: finding.recommended_action ?? "",
    assigned_owner: finding.assigned_owner ?? "",
    target_date: finding.target_date ?? "",
    status: finding.status as FindingStatus,
    closure_evidence: finding.closure_evidence ?? "",
    verified_by: finding.verified_by ?? "",
    verification_date: finding.verification_date ?? "",
  });
  const [contribute, setContribute] = useState(false);
  const isClosing = form.status === "closed" || form.status === "accepted_risk";

  useEffect(() => {
    if (!open) return;
    setForm({
      description: finding.description,
      severity: finding.severity,
      category_name: finding.category_name ?? "",
      root_cause: finding.root_cause ?? "",
      recommended_action: finding.recommended_action ?? "",
      assigned_owner: finding.assigned_owner ?? "",
      target_date: finding.target_date ?? "",
      status: finding.status,
      closure_evidence: finding.closure_evidence ?? "",
      verified_by: finding.verified_by ?? "",
      verification_date: finding.verification_date ?? "",
    });
    setContribute(false);
  }, [open, finding]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Manage finding {finding.finding_code ?? ""}</DialogTitle>
          <DialogDescription>
            Edit the finding itself, assign an owner, track progress and verify
            closure.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[65vh] space-y-4 overflow-y-auto pr-1">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field label="Description">
                <Textarea
                  rows={3}
                  value={form.description}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, description: e.target.value }))
                  }
                />
              </Field>
            </div>
            <Field label="Severity">
              <Select
                value={form.severity}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, severity: v as FindingSeverity }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SEVERITY_ORDER.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Category">
              <Input
                value={form.category_name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, category_name: e.target.value }))
                }
              />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Root cause">
                <Textarea
                  rows={2}
                  value={form.root_cause}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, root_cause: e.target.value }))
                  }
                />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Recommended action">
                <Textarea
                  rows={2}
                  value={form.recommended_action}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      recommended_action: e.target.value,
                    }))
                  }
                />
              </Field>
            </div>
          </div>

          <div className="border-t border-border pt-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Assigned owner">
                <Input
                  value={form.assigned_owner}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, assigned_owner: e.target.value }))
                  }
                />
              </Field>
              <Field label="Target date">
                <Input
                  type="date"
                  value={form.target_date}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, target_date: e.target.value }))
                  }
                />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Status">
                  <Select
                    value={form.status}
                    onValueChange={(v) =>
                      setForm((f) => ({ ...f, status: v as FindingStatus }))
                    }
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
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        closure_evidence: e.target.value,
                      }))
                    }
                  />
                </Field>
              </div>
              <Field label="Verified by">
                <Input
                  value={form.verified_by}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, verified_by: e.target.value }))
                  }
                />
              </Field>
              <Field label="Verification date">
                <Input
                  type="date"
                  value={form.verification_date}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      verification_date: e.target.value,
                    }))
                  }
                />
              </Field>
              {isClosing ? (
                <div className="sm:col-span-2 flex items-start gap-2 rounded-md border border-border bg-muted/20 p-3">
                  <Checkbox
                    id={`contribute-finding-${finding.id}`}
                    checked={contribute}
                    onCheckedChange={(v) => setContribute(v === true)}
                  />
                  <Label
                    htmlFor={`contribute-finding-${finding.id}`}
                    className="text-xs font-normal text-muted-foreground"
                  >
                    Contribute an anonymized version of this resolution to the
                    IronIQ Intelligence Layer, to help other shops with similar
                    problems. Nothing identifying is shared, and it's reviewed
                    before it's ever visible to anyone else.
                  </Label>
                </div>
              ) : null}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button
            disabled={update.isPending}
            onClick={() =>
              update.mutate(
                {
                  id: finding.id,
                  values: {
                    description: form.description,
                    severity: form.severity,
                    category_name: form.category_name || null,
                    root_cause: form.root_cause || null,
                    recommended_action: form.recommended_action || null,
                    assigned_owner: form.assigned_owner || null,
                    target_date: form.target_date || null,
                    status: form.status,
                    closure_evidence: form.closure_evidence || null,
                    verified_by: form.verified_by || null,
                    verification_date: form.verification_date || null,
                  },
                  contributeToIntelligence: isClosing && contribute,
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
            <p className="text-sm text-muted-foreground">
              No findings available for this facility.
            </p>
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

const CORRECTIVE_ACTION_STATUSES = Object.keys(
  FINDING_STATUS_LABELS,
) as FindingStatus[];

/**
 * corrective_actions had no create/edit path in the app at all before this
 * — only a read-only display. This is its first write capability,
 * including the Intelligence Layer consent checkbox shown when closing.
 */
export function CorrectiveActionDialog({
  action,
  findingId,
  facilityId,
  trigger,
}: {
  /** Undefined when creating a new corrective action for a finding. */
  action?: CorrectiveAction;
  findingId: string;
  facilityId: string;
  trigger: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const save = useSaveCorrectiveAction();
  const draftAI = useDraftFromPrecedent();
  // Reused rather than a new fetch — useFindings(facilityId) is already
  // called by the page this dialog opens from (findings.tsx), so this is
  // almost always served from cache, not a fresh round trip.
  const finding = useFindings(facilityId).data?.find((f) => f.id === findingId);
  const [form, setForm] = useState({
    action_description: action?.action_description ?? "",
    owner: action?.owner ?? "",
    target_date: action?.target_date ?? "",
    completed_date: action?.completed_date ?? "",
    status: (action?.status ?? "open") as FindingStatus,
    verification_notes: action?.verification_notes ?? "",
  });
  const [contribute, setContribute] = useState(false);
  const isClosing = form.status === "closed";

  useEffect(() => {
    if (!open) return;
    setForm({
      action_description: action?.action_description ?? "",
      owner: action?.owner ?? "",
      target_date: action?.target_date ?? "",
      completed_date: action?.completed_date ?? "",
      status: action?.status ?? "open",
      verification_notes: action?.verification_notes ?? "",
    });
    setContribute(false);
  }, [open, action]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {action ? "Manage corrective action" : "New corrective action"}
          </DialogTitle>
          <DialogDescription>
            The specific fix being applied for this finding, tracked to verified
            closure.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Action description">
              <Textarea
                rows={3}
                value={form.action_description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, action_description: e.target.value }))
                }
              />
            </Field>
            <div className="mt-1.5 flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={!finding?.description || draftAI.isPending}
                onClick={() =>
                  finding?.description &&
                  draftAI.mutate(
                    {
                      problemDescription: finding.description,
                      fieldLabel: "corrective action",
                    },
                    {
                      onSuccess: (result) => {
                        if (result.draft) {
                          setForm((f) => ({
                            ...f,
                            action_description: result.draft as string,
                          }));
                        } else {
                          toast.info(
                            "No closely-matching precedent found for this finding yet.",
                          );
                        }
                      },
                    },
                  )
                }
              >
                {draftAI.isPending
                  ? "Checking precedent…"
                  : "Draft from precedent"}
              </Button>
              {draftAI.data?.draft ? (
                <span className="text-xs text-muted-foreground">
                  AI-drafted from {draftAI.data.patterns.length} pattern
                  {draftAI.data.patterns.length === 1 ? "" : "s"} — review
                  before saving
                </span>
              ) : null}
            </div>
          </div>
          <Field label="Owner">
            <Input
              value={form.owner}
              onChange={(e) =>
                setForm((f) => ({ ...f, owner: e.target.value }))
              }
            />
          </Field>
          <Field label="Target date">
            <Input
              type="date"
              value={form.target_date}
              onChange={(e) =>
                setForm((f) => ({ ...f, target_date: e.target.value }))
              }
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Status">
              <Select
                value={form.status}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, status: v as FindingStatus }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CORRECTIVE_ACTION_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {FINDING_STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field label="Completed date">
            <Input
              type="date"
              value={form.completed_date}
              onChange={(e) =>
                setForm((f) => ({ ...f, completed_date: e.target.value }))
              }
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Verification notes">
              <Textarea
                rows={3}
                value={form.verification_notes}
                onChange={(e) =>
                  setForm((f) => ({ ...f, verification_notes: e.target.value }))
                }
              />
            </Field>
          </div>
          {isClosing ? (
            <div className="sm:col-span-2 flex items-start gap-2 rounded-md border border-border bg-muted/20 p-3">
              <Checkbox
                id={`contribute-action-${action?.id ?? "new"}`}
                checked={contribute}
                onCheckedChange={(v) => setContribute(v === true)}
              />
              <Label
                htmlFor={`contribute-action-${action?.id ?? "new"}`}
                className="text-xs font-normal text-muted-foreground"
              >
                Contribute an anonymized version of this resolution to the
                IronIQ Intelligence Layer, to help other shops with similar
                problems. Nothing identifying is shared, and it's reviewed
                before it's ever visible to anyone else.
              </Label>
            </div>
          ) : null}
        </div>
        <DialogFooter>
          <Button
            disabled={save.isPending}
            onClick={() =>
              save.mutate(
                {
                  id: action?.id,
                  values: {
                    finding_id: findingId,
                    facility_id: facilityId,
                    action_description: form.action_description,
                    owner: form.owner || null,
                    target_date: form.target_date || null,
                    completed_date: form.completed_date || null,
                    status: form.status,
                    verification_notes: form.verification_notes || null,
                  },
                  contributeToIntelligence: isClosing && contribute,
                },
                { onSuccess: () => setOpen(false) },
              )
            }
          >
            Save corrective action
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const IMPROVEMENT_PROJECT_STATUSES = Object.keys(
  PROJECT_STATUS_LABELS,
) as ProjectStatus[];

/**
 * improvement_projects had no create/edit path in the app at all before
 * this — only a read-only display. This is its first write capability,
 * including the Intelligence Layer consent checkbox shown when completing.
 */
export function ImprovementProjectDialog({
  project,
  organizationId,
  facilityId,
  trigger,
}: {
  /** Undefined when creating a new project. */
  project?: ImprovementProject;
  organizationId: string;
  facilityId: string;
  trigger: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const save = useSaveImprovementProject();
  const [form, setForm] = useState({
    name: project?.name ?? "",
    owner: project?.owner ?? "",
    executive_sponsor: project?.executive_sponsor ?? "",
    objective: project?.objective ?? "",
    baseline_metric: project?.baseline_metric ?? "",
    target_metric: project?.target_metric ?? "",
    estimated_financial_impact:
      project?.estimated_financial_impact?.toString() ?? "",
    planned_start: project?.planned_start ?? "",
    planned_completion: project?.planned_completion ?? "",
    status: (project?.status ?? "proposed") as ProjectStatus,
    percent_complete: project?.percent_complete ?? 0,
    risks: project?.risks ?? "",
    actions: project?.actions ?? "",
    results: project?.results ?? "",
  });
  const [contribute, setContribute] = useState(false);
  const isCompleting = form.status === "complete";

  useEffect(() => {
    if (!open) return;
    setForm({
      name: project?.name ?? "",
      owner: project?.owner ?? "",
      executive_sponsor: project?.executive_sponsor ?? "",
      objective: project?.objective ?? "",
      baseline_metric: project?.baseline_metric ?? "",
      target_metric: project?.target_metric ?? "",
      estimated_financial_impact:
        project?.estimated_financial_impact?.toString() ?? "",
      planned_start: project?.planned_start ?? "",
      planned_completion: project?.planned_completion ?? "",
      status: project?.status ?? "proposed",
      percent_complete: project?.percent_complete ?? 0,
      risks: project?.risks ?? "",
      actions: project?.actions ?? "",
      results: project?.results ?? "",
    });
    setContribute(false);
  }, [open, project]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {project ? "Manage project" : "New improvement project"}
          </DialogTitle>
          <DialogDescription>
            The execution layer of the readiness programme — tracked to
            measurable results.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[65vh] space-y-4 overflow-y-auto pr-1">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field label="Name">
                <Input
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                />
              </Field>
            </div>
            <Field label="Owner">
              <Input
                value={form.owner}
                onChange={(e) =>
                  setForm((f) => ({ ...f, owner: e.target.value }))
                }
              />
            </Field>
            <Field label="Executive sponsor">
              <Input
                value={form.executive_sponsor}
                onChange={(e) =>
                  setForm((f) => ({ ...f, executive_sponsor: e.target.value }))
                }
              />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Objective">
                <Textarea
                  rows={2}
                  value={form.objective}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, objective: e.target.value }))
                  }
                />
              </Field>
            </div>
            <Field label="Baseline metric">
              <Input
                value={form.baseline_metric}
                onChange={(e) =>
                  setForm((f) => ({ ...f, baseline_metric: e.target.value }))
                }
              />
            </Field>
            <Field label="Target metric">
              <Input
                value={form.target_metric}
                onChange={(e) =>
                  setForm((f) => ({ ...f, target_metric: e.target.value }))
                }
              />
            </Field>
            <Field label="Estimated financial impact ($)">
              <Input
                type="number"
                value={form.estimated_financial_impact}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    estimated_financial_impact: e.target.value,
                  }))
                }
              />
            </Field>
            <div>
              <Field label="Status">
                <Select
                  value={form.status}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, status: v as ProjectStatus }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {IMPROVEMENT_PROJECT_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {PROJECT_STATUS_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <Field label="Planned start">
              <Input
                type="date"
                value={form.planned_start}
                onChange={(e) =>
                  setForm((f) => ({ ...f, planned_start: e.target.value }))
                }
              />
            </Field>
            <Field label="Planned completion">
              <Input
                type="date"
                value={form.planned_completion}
                onChange={(e) =>
                  setForm((f) => ({ ...f, planned_completion: e.target.value }))
                }
              />
            </Field>
            <Field label="Percent complete">
              <Input
                type="number"
                min={0}
                max={100}
                value={form.percent_complete}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    percent_complete: Number(e.target.value),
                  }))
                }
              />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Risks">
                <Textarea
                  rows={2}
                  value={form.risks}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, risks: e.target.value }))
                  }
                />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Actions taken">
                <Textarea
                  rows={3}
                  value={form.actions}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, actions: e.target.value }))
                  }
                />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Results">
                <Textarea
                  rows={3}
                  value={form.results}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, results: e.target.value }))
                  }
                />
              </Field>
            </div>
            {isCompleting ? (
              <div className="sm:col-span-2 flex items-start gap-2 rounded-md border border-border bg-muted/20 p-3">
                <Checkbox
                  id={`contribute-project-${project?.id ?? "new"}`}
                  checked={contribute}
                  onCheckedChange={(v) => setContribute(v === true)}
                />
                <Label
                  htmlFor={`contribute-project-${project?.id ?? "new"}`}
                  className="text-xs font-normal text-muted-foreground"
                >
                  Contribute an anonymized version of this project's resolution
                  to the IronIQ Intelligence Layer, to help other shops with
                  similar problems. Nothing identifying is shared, and it's
                  reviewed before it's ever visible to anyone else.
                </Label>
              </div>
            ) : null}
          </div>
        </div>
        <DialogFooter>
          <Button
            disabled={save.isPending}
            onClick={() =>
              save.mutate(
                {
                  id: project?.id,
                  values: {
                    organization_id: organizationId,
                    facility_id: facilityId,
                    name: form.name,
                    owner: form.owner || null,
                    executive_sponsor: form.executive_sponsor || null,
                    objective: form.objective || null,
                    baseline_metric: form.baseline_metric || null,
                    target_metric: form.target_metric || null,
                    estimated_financial_impact: form.estimated_financial_impact
                      ? Number(form.estimated_financial_impact)
                      : null,
                    planned_start: form.planned_start || null,
                    planned_completion: form.planned_completion || null,
                    status: form.status,
                    percent_complete: form.percent_complete,
                    risks: form.risks || null,
                    actions: form.actions || null,
                    results: form.results || null,
                  },
                  contributeToIntelligence: isCompleting && contribute,
                },
                { onSuccess: () => setOpen(false) },
              )
            }
          >
            Save project
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
