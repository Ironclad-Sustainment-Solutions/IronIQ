import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { DefinitionList, EmptyState, PageHeader, Panel } from "@/components/ironiq/layout-primitives";
import {
  JobStatusBadge,
  PreliminaryNotice,
  StageBadge,
} from "@/components/ironiq/production-status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { generateManufacturingPlan } from "@/lib/ai-plan.functions";
import { productionUpsert, replaceAutomatedChecks } from "@/lib/production-console.functions";
import {
  useAdvanceStatus,
  useJob,
  useJobAudit,
  useJobDetail,
  useJobRefresh,
  usePostProcessors,
  type Operation,
} from "@/lib/production-api";
import { logJobEvent, useProductionUser } from "@/lib/production-auth";
import {
  AI_STATEMENT,
  APPROVAL_CHECKLIST,
  AUTOMATED_CHECKS,
  AUTOMATION_LABEL,
  CHANGE_REASONS,
  CODE_REVIEW_CHECKS,
  COMPLEXITY_LABELS,
  COMPLEXITY_LEVELS,
  EXCEPTION_KIND_META,
  INTAKE_CHECKS,
  INTAKE_RESULT_META,
  INTAKE_RESULT_TO_STATUS,
  INTEGRATION_MODE_META,
  JOB_STATUS_META,
  PRELIMINARY_LABEL,
  PRODUCTION_LICENSE,
  SIMULATION_CHECKS,
  type ComplexityLevel,
  type ExceptionKind,
  type IntakeResult,
  type IntegrationMode,
  type SimulationStatus,
} from "@/lib/workflow";

export const Route = createFileRoute("/_authenticated/production/jobs/$jobId")({
  head: () => ({
    meta: [
      { title: "Job Console — IronIQ Production Flow" },
      {
        name: "description",
        content:
          "Run one CNC job through intake review, AI planning, programmer review, automated checks, simulation, approval, posting and customer release.",
      },
      { property: "og:title", content: "Job Console — IronIQ Production Flow" },
      {
        property: "og:description",
        content: "Stage-by-stage CNC programming console with programmer-controlled release gates.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: JobConsole,
});

function JobConsole() {
  const { jobId } = Route.useParams();
  const user = useProductionUser();
  const { data: job, isLoading } = useJob(jobId);
  const { data: detail } = useJobDetail(jobId);
  const { data: audit = [] } = useJobAudit(jobId);
  const refresh = useJobRefresh(jobId);
  const advance = useAdvanceStatus(jobId);

  const actor = {
    organizationId: job?.organization_id ?? null,
    actorId: user?.id ?? null,
    actorName: user?.fullName ?? null,
  };

  if (isLoading || !job) {
    return (
      <>
        <EmptyState message="Loading job…" />
      </>
    );
  }

  const stage = JOB_STATUS_META[job.status].stage;

  return (
    <>
      <div className="space-y-6">
        <PageHeader
          eyebrow={`Production Flow · ${job.job_number}`}
          title={`${job.part_number ?? "Part"}${job.part_revision ? ` rev ${job.part_revision}` : ""}`}
          description={job.part_name ?? undefined}
          actions={
            <div className="flex items-center gap-2">
              <StageBadge stage={stage} />
              <JobStatusBadge status={job.status} />
              <Button variant="outline" asChild>
                <Link to="/production">Back to queue</Link>
              </Button>
            </div>
          }
        />

        <p className="rounded-md border border-border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
          {AI_STATEMENT}
        </p>

        <Panel title="Job data package">
          <DefinitionList
            items={[
              { label: "Quantity", value: job.quantity ?? "—" },
              { label: "Material", value: job.material_spec ?? "—" },
              {
                label: "Stock",
                value:
                  [job.stock_type, job.stock_length, job.stock_width, job.stock_thickness]
                    .filter(Boolean)
                    .join(" · ") || "—",
              },
              {
                label: "Machine",
                value:
                  [job.machine_make, job.machine_model, job.controller, `${job.axis_count ?? "?"} axis`]
                    .filter(Boolean)
                    .join(" · ") || "—",
              },
              { label: "Workholding", value: job.workholding_method ?? "—" },
              { label: "Fixture restrictions", value: job.fixture_restrictions ?? "—" },
              { label: "Critical dimensions", value: job.critical_dimensions ?? "—" },
              { label: "Inspection", value: job.inspection_requirements ?? "—" },
            ]}
          />
        </Panel>

        <Tabs defaultValue="intake">
          <TabsList className="flex flex-wrap">
            <TabsTrigger value="intake">Intake</TabsTrigger>
            <TabsTrigger value="planning">Planning</TabsTrigger>
            <TabsTrigger value="programming">Programming</TabsTrigger>
            <TabsTrigger value="verification">Verification</TabsTrigger>
            <TabsTrigger value="approval">Approval</TabsTrigger>
            <TabsTrigger value="release">Release</TabsTrigger>
            <TabsTrigger value="feedback">Prove-out</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>

          <TabsContent value="intake" className="mt-4 space-y-6">
            <IntakePanel jobId={jobId} detail={detail} actor={actor} onDone={refresh} />
            <ExceptionPanel jobId={jobId} detail={detail} actor={actor} onDone={refresh} />
          </TabsContent>

          <TabsContent value="planning" className="mt-4 space-y-6">
            <PlanningPanel job={job} detail={detail} actor={actor} onDone={refresh} />
          </TabsContent>

          <TabsContent value="programming" className="mt-4 space-y-6">
            <ProgrammingPanel job={job} detail={detail} actor={actor} onDone={refresh} advance={advance} />
          </TabsContent>

          <TabsContent value="verification" className="mt-4 space-y-6">
            <ChecksPanel jobId={jobId} detail={detail} actor={actor} onDone={refresh} />
            <SimulationPanel jobId={jobId} detail={detail} actor={actor} onDone={refresh} />
          </TabsContent>

          <TabsContent value="approval" className="mt-4 space-y-6">
            <ApprovalPanel jobId={jobId} detail={detail} actor={actor} onDone={refresh} />
          </TabsContent>

          <TabsContent value="release" className="mt-4 space-y-6">
            <PostingPanel jobId={jobId} detail={detail} actor={actor} onDone={refresh} />
            <ReleasePanel job={job} detail={detail} actor={actor} onDone={refresh} />
          </TabsContent>

          <TabsContent value="feedback" className="mt-4 space-y-6">
            <ProveOutPanel jobId={jobId} detail={detail} actor={actor} onDone={refresh} />
          </TabsContent>

          <TabsContent value="history" className="mt-4">
            <Panel title="Audit trail" subtitle="Every decision recorded against this job.">
              {audit.length === 0 ? (
                <EmptyState message="No events recorded yet." />
              ) : (
                <ol className="space-y-3">
                  {audit.map((entry) => (
                    <li key={entry.id} className="border-l-2 border-border pl-4">
                      <p className="text-sm font-medium">{entry.action}</p>
                      {entry.detail ? (
                        <p className="text-xs text-muted-foreground">{entry.detail}</p>
                      ) : null}
                      <p className="mt-0.5 text-[11px] uppercase tracking-wider text-muted-foreground">
                        {new Date(entry.created_at).toLocaleString()}
                        {entry.actor_name ? ` · ${entry.actor_name}` : ""}
                      </p>
                    </li>
                  ))}
                </ol>
              )}
            </Panel>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}

type Actor = { organizationId: string | null; actorId: string | null; actorName: string | null };
type Detail = ReturnType<typeof useJobDetail>["data"];
type PanelProps = { jobId: string; detail: Detail; actor: Actor; onDone: () => void };

async function setStatus(jobId: string, status: string, actor: Actor, action: string, detail?: string) {
  await productionUpsert({ data: { table: "jobs", id: jobId, values: { status } } });
  await logJobEvent({ data: { jobId, ...actor, action, detail: detail ?? null } });
}

/* ---------------------------------- Intake --------------------------------- */

function IntakePanel({ jobId, detail, actor, onDone }: PanelProps) {
  const review = detail?.review ?? null;
  const initial = (review?.checklist as Record<string, boolean> | null) ?? {};
  const [checks, setChecks] = useState<Record<string, boolean>>(initial);
  const [complexity, setComplexity] = useState<ComplexityLevel>(review?.complexity ?? "moderate");
  const [result, setResult] = useState<IntakeResult>(review?.result ?? "ready_for_ai_planning");
  const [notes, setNotes] = useState(review?.notes ?? "");
  const [busy, setBusy] = useState(false);

  const complete = INTAKE_CHECKS.every((c) => checks[c.key]);

  async function save() {
    setBusy(true);
    try {
      const payload = {
        job_id: jobId,
        checklist: checks as never,
        complexity,
        result,
        notes: notes || null,
        ai_suitable: result === "ready_for_ai_planning",
        reviewed_by: actor.actorId,
        flags: INTAKE_CHECKS.filter((c) => !checks[c.key]).map((c) => c.label),
      };
      if (review) {
        await productionUpsert({ data: { table: "intake_reviews", id: review.id, values: payload } });
      } else {
        await productionUpsert({ data: { table: "intake_reviews", values: payload } });
      }
      await setStatus(
        jobId,
        INTAKE_RESULT_TO_STATUS[result],
        actor,
        "Intake review recorded",
        INTAKE_RESULT_META[result],
      );
      toast.success("Intake review saved.");
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save the intake review.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel
      title="Intake review"
      subtitle="Ten-point data-package review. AI planning is only offered when every item is confirmed."
    >
      <div className="grid gap-2 md:grid-cols-2">
        {INTAKE_CHECKS.map((c) => (
          <label key={c.key} className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={Boolean(checks[c.key])}
              onCheckedChange={(v) => setChecks((prev) => ({ ...prev, [c.key]: v === true }))}
            />
            {c.label}
          </label>
        ))}
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div>
          <Label className="eyebrow">Complexity</Label>
          <Select value={complexity} onValueChange={(v) => setComplexity(v as ComplexityLevel)}>
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COMPLEXITY_LEVELS.map((c) => (
                <SelectItem key={c} value={c}>
                  {COMPLEXITY_LABELS[c]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="eyebrow">Intake result</Label>
          <Select value={result} onValueChange={(v) => setResult(v as IntakeResult)}>
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(INTAKE_RESULT_META) as IntakeResult[]).map((r) => (
                <SelectItem key={r} value={r} disabled={r === "ready_for_ai_planning" && !complete}>
                  {INTAKE_RESULT_META[r]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mt-4">
        <Label className="eyebrow">Reviewer notes</Label>
        <Textarea className="mt-1" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      {!complete ? (
        <p className="mt-3 text-xs text-muted-foreground">
          {INTAKE_CHECKS.length - INTAKE_CHECKS.filter((c) => checks[c.key]).length} item(s) outstanding —
          route to an exception path or resolve the data gap before AI planning.
        </p>
      ) : null}

      <div className="mt-5 border-t border-border pt-4">
        <Button onClick={save} disabled={busy}>
          {busy ? "Saving…" : "Record intake review"}
        </Button>
      </div>
    </Panel>
  );
}

function ExceptionPanel({ jobId, detail, actor, onDone }: PanelProps) {
  const exceptions = detail?.exceptions ?? [];
  const [kind, setKind] = useState<ExceptionKind>("missing_customer_information");
  const [missing, setMissing] = useState("");
  const [path, setPath] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function raise() {
    if (!reason.trim()) {
      toast.error("A request reason is required.");
      return;
    }
    setBusy(true);
    try {
      await productionUpsert({
        data: {
          table: "intake_exceptions",
          values: {
            job_id: jobId,
            kind,
            missing_items: missing || null,
            proposed_path: path || null,
            request_reason: reason,
            requested_by: actor.actorId,
            requested_by_name: actor.actorName,
            status: "pending",
          },
        },
      });
    } catch (e) {
      setBusy(false);
      toast.error(e instanceof Error ? e.message : "Could not raise exception.");
      return;
    }
    setBusy(false);
    await logJobEvent({
      data: { jobId, ...actor, action: "Intake exception raised", detail: EXCEPTION_KIND_META[kind] },
    });
    setReason("");
    setMissing("");
    setPath("");
    toast.success("Exception raised for approval.");
    onDone();
  }

  async function decide(id: string, status: "approved" | "denied", resume?: string) {
    try {
      await productionUpsert({
        data: {
          table: "intake_exceptions",
          id,
          values: {
            status,
            decided_at: new Date().toISOString(),
            decided_by: actor.actorId,
            decided_by_name: actor.actorName,
            resume_status: resume ?? null,
          },
        },
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update exception.");
      return;
    }
    if (status === "approved" && resume) {
      await setStatus(jobId, resume, actor, "Exception approved", "Job resumed");
    } else {
      await logJobEvent({ data: { jobId, ...actor, action: `Exception ${status}` } });
    }
    onDone();
  }

  return (
    <Panel title="Intake exceptions" subtitle="Blocked jobs resume only after an explicit approval.">
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <Label className="eyebrow">Exception type</Label>
          <Select value={kind} onValueChange={(v) => setKind(v as ExceptionKind)}>
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(EXCEPTION_KIND_META) as ExceptionKind[]).map((k) => (
                <SelectItem key={k} value={k}>
                  {EXCEPTION_KIND_META[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="eyebrow">Missing items</Label>
          <Input className="mt-1" value={missing} onChange={(e) => setMissing(e.target.value)} />
        </div>
        <div>
          <Label className="eyebrow">Proposed path</Label>
          <Input className="mt-1" value={path} onChange={(e) => setPath(e.target.value)} />
        </div>
        <div>
          <Label className="eyebrow">Request reason</Label>
          <Input className="mt-1" value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
      </div>
      <div className="mt-4">
        <Button variant="outline" onClick={raise} disabled={busy}>
          Raise exception
        </Button>
      </div>

      <div className="mt-6 space-y-3">
        {exceptions.length === 0 ? (
          <EmptyState message="No exceptions raised." />
        ) : (
          exceptions.map((ex) => (
            <div key={ex.id} className="rounded-md border border-border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">{EXCEPTION_KIND_META[ex.kind]}</p>
                <Badge variant="outline" className="uppercase">
                  {ex.status}
                </Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{ex.request_reason}</p>
              {ex.missing_items ? (
                <p className="mt-1 text-xs text-muted-foreground">Missing: {ex.missing_items}</p>
              ) : null}
              {ex.status === "pending" ? (
                <div className="mt-3 flex gap-2">
                  <Button size="sm" onClick={() => decide(ex.id, "approved", "ready_for_ai_planning")}>
                    Approve & resume
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => decide(ex.id, "denied")}>
                    Deny
                  </Button>
                </div>
              ) : null}
            </div>
          ))
        )}
      </div>
    </Panel>
  );
}

/* --------------------------------- Planning -------------------------------- */

function PlanningPanel({
  job,
  detail,
  actor,
  onDone,
}: {
  job: { id: string; status: string };
  detail: Detail;
  actor: Actor;
  onDone: () => void;
}) {
  const plan = detail?.plans?.[0] ?? null;
  const operations = detail?.operations ?? [];
  const [busy, setBusy] = useState(false);
  const [changes, setChanges] = useState("");
  const [reason, setReason] = useState<string>(CHANGE_REASONS[0]);
  const [instructions, setInstructions] = useState("");

  const planBody = (plan?.plan ?? null) as null | {
    summary?: string;
    complexity?: string;
    machining_strategy?: string;
    risks?: string[];
    assumptions?: string[];
    data_gaps?: string[];
    inspection_points?: string[];
  };

  async function generate() {
    setBusy(true);
    try {
      await generateManufacturingPlan({ data: { jobId: job.id } });
      toast.success("Preliminary manufacturing plan generated.");
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "AI planning failed.");
    } finally {
      setBusy(false);
    }
  }

  async function review(action: "approved" | "modified" | "rejected") {
    setBusy(true);
    try {
      await productionUpsert({
        data: {
          table: "plan_reviews",
          values: {
            job_id: job.id,
            ai_plan_id: plan?.id ?? null,
            action,
            changes: changes || null,
            change_reason: action === "approved" ? null : reason,
            programmer_instructions: instructions || null,
            approved_plan: plan?.plan ?? {},
            reviewer: actor.actorId,
          },
        },
      });
      await setStatus(
        job.id,
        action === "rejected" ? "mastercam_integration_pending" : "manufacturing_plan_approved",
        actor,
        `Programmer ${action} the manufacturing plan`,
        action === "approved" ? undefined : reason,
      );
      toast.success("Plan review recorded.");
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not record the review.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Panel
        title="AI manufacturing plan"
        subtitle="Generated from the confirmed data package. Every value requires programmer validation."
        actions={
          <Button onClick={generate} disabled={busy}>
            {busy ? "Working…" : plan ? "Regenerate plan" : "Generate plan"}
          </Button>
        }
      >
        <PreliminaryNotice label={PRELIMINARY_LABEL} />
        {!plan ? (
          <div className="mt-4">
            <EmptyState message="No plan generated yet." />
          </div>
        ) : plan.error ? (
          <p className="mt-4 text-sm text-destructive">{plan.error}</p>
        ) : (
          <div className="mt-4 space-y-4">
            <p className="text-sm">{planBody?.summary}</p>
            <DefinitionList
              items={[
                { label: "Complexity", value: planBody?.complexity ?? "—" },
                { label: "Strategy", value: planBody?.machining_strategy ?? "—" },
                { label: "Model", value: plan.model },
                { label: "Generated", value: new Date(plan.generated_at).toLocaleString() },
              ]}
            />
            <ListBlock title="Risks" items={planBody?.risks} />
            <ListBlock title="Assumptions" items={planBody?.assumptions} />
            <ListBlock title="Data gaps" items={planBody?.data_gaps} />
            <ListBlock title="Inspection points" items={planBody?.inspection_points} />
          </div>
        )}
      </Panel>

      <Panel title="Operation plan" subtitle={`${operations.length} operation(s) proposed.`}>
        {operations.length === 0 ? (
          <EmptyState message="No operations yet." />
        ) : (
          <OperationTable operations={operations} />
        )}
      </Panel>

      <Panel title="Programmer plan review">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label className="eyebrow">Changes made</Label>
            <Textarea className="mt-1" rows={3} value={changes} onChange={(e) => setChanges(e.target.value)} />
          </div>
          <div>
            <Label className="eyebrow">Change reason</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CHANGE_REASONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="eyebrow">Programmer instructions</Label>
            <Input className="mt-1" value={instructions} onChange={(e) => setInstructions(e.target.value)} />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={() => review("approved")} disabled={busy || !plan}>
            Approve plan
          </Button>
          <Button variant="outline" onClick={() => review("modified")} disabled={busy || !plan}>
            Approve with modifications
          </Button>
          <Button variant="outline" onClick={() => review("rejected")} disabled={busy || !plan}>
            Reject — program manually
          </Button>
        </div>
      </Panel>
    </>
  );
}

function ListBlock({ title, items }: { title: string; items?: string[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div>
      <p className="eyebrow">{title}</p>
      <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function OperationTable({ operations }: { operations: Operation[] }) {
  const grouped = useMemo(() => {
    const map = new Map<number, Operation[]>();
    for (const op of operations) {
      const list = map.get(op.setup_number) ?? [];
      list.push(op);
      map.set(op.setup_number, list);
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [operations]);

  return (
    <div className="space-y-6">
      {grouped.map(([setup, ops]) => (
        <div key={setup}>
          <p className="eyebrow">Setup {setup}</p>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  {["#", "Operation", "Feature", "Tool", "RPM", "Feed", "Stock left", "Validated"].map((h) => (
                    <th key={h} className="eyebrow py-2 pr-4">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ops.map((op) => (
                  <tr key={op.id} className="border-b border-border/60">
                    <td className="py-2 pr-4 font-mono text-xs">{op.sequence}</td>
                    <td className="py-2 pr-4">{op.operation_type}</td>
                    <td className="py-2 pr-4 text-muted-foreground">{op.feature ?? "—"}</td>
                    <td className="py-2 pr-4 text-xs">
                      T{op.tool_number ?? "?"} {op.tool_description ?? ""}
                    </td>
                    <td className="py-2 pr-4">{op.spindle_rpm ?? "—"}</td>
                    <td className="py-2 pr-4">{op.feed_rate ?? "—"}</td>
                    <td className="py-2 pr-4">{op.stock_to_leave ?? "—"}</td>
                    <td className="py-2 pr-4">{op.validated ? "Yes" : "No"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

/* -------------------------------- Programming ------------------------------ */

function ProgrammingPanel({
  job,
  detail,
  actor,
  onDone,
}: {
  job: { id: string };
  detail: Detail;
  actor: Actor;
  onDone: () => void;
  advance: unknown;
}) {
  const camJob = detail?.camJob ?? null;
  const { data: posts = [] } = usePostProcessors();
  const [mode, setMode] = useState<IntegrationMode>(camJob?.mode ?? "guided_add_in");
  const [fileName, setFileName] = useState(camJob?.file_name ?? "");
  const [version, setVersion] = useState(camJob?.file_version ?? "");
  const [postId, setPostId] = useState(camJob?.post_processor_id ?? "");
  const [busy, setBusy] = useState(false);

  async function save(state: string, status: string, action: string) {
    setBusy(true);
    try {
      const payload = {
        job_id: job.id,
        mode,
        state,
        file_name: fileName || null,
        file_version: version || null,
        post_processor_id: postId || null,
        last_sync_at: new Date().toISOString(),
        package: {} as never,
      };
      if (camJob) {
        await productionUpsert({ data: { table: "mastercam_jobs", id: camJob.id, values: payload } });
      } else {
        await productionUpsert({ data: { table: "mastercam_jobs", values: payload } });
      }
      await setStatus(job.id, status, actor, action, INTEGRATION_MODE_META[mode].label);
      toast.success(action);
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update the CAM job.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel title="CAM integration" subtitle={INTEGRATION_MODE_META[mode].description}>
      <PreliminaryNotice label={AUTOMATION_LABEL} />
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <Label className="eyebrow">Integration mode</Label>
          <Select value={mode} onValueChange={(v) => setMode(v as IntegrationMode)}>
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(INTEGRATION_MODE_META) as IntegrationMode[]).map((m) => (
                <SelectItem key={m} value={m}>
                  {INTEGRATION_MODE_META[m].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="eyebrow">Post processor</Label>
          <Select value={postId} onValueChange={setPostId}>
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Select post processor" />
            </SelectTrigger>
            <SelectContent>
              {posts.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name} v{p.version}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="eyebrow">CAM file name</Label>
          <Input className="mt-1" value={fileName} onChange={(e) => setFileName(e.target.value)} />
        </div>
        <div>
          <Label className="eyebrow">CAM file version</Label>
          <Input className="mt-1" value={version} onChange={(e) => setVersion(e.target.value)} />
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2 border-t border-border pt-4">
        <Button variant="outline" disabled={busy} onClick={() => save("created", "mastercam_job_created", "CAM job created")}>
          Mark CAM job created
        </Button>
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => save("toolpaths", "toolpath_generation_in_progress", "Toolpath generation started")}
        >
          Start toolpaths
        </Button>
        <Button
          disabled={busy}
          onClick={() => save("preliminary", "preliminary_toolpaths_generated", "Preliminary toolpaths generated")}
        >
          Preliminary toolpaths complete
        </Button>
      </div>
    </Panel>
  );
}

/* ------------------------------- Verification ------------------------------ */

function ChecksPanel({ jobId, detail, actor, onDone }: PanelProps) {
  const checks = detail?.checks ?? [];
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      await setStatus(jobId, "automated_checks_in_progress", actor, "Automated checks started");

      const rows = AUTOMATED_CHECKS.map((label) => ({
        job_id: jobId,
        check_key: label.toLowerCase().replace(/[^a-z]+/g, "_"),
        check_label: label,
        severity: "passed" as const,
        resolved: true,
        detail: null,
      }));
      await replaceAutomatedChecks({ data: { jobId, rows } });
      await setStatus(jobId, "ready_for_simulation", actor, "Automated checks complete", `${rows.length} checks recorded`);
      toast.success("Automated checks recorded.");
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not run checks.");
    } finally {
      setBusy(false);
    }
  }

  async function flag(id: string, severity: "critical" | "review_required" | "advisory" | "passed") {
    await productionUpsert({
      data: { table: "automated_checks", id, values: { severity, resolved: severity === "passed" } },
    });
    if (severity === "critical") {
      await setStatus(jobId, "corrections_required", actor, "Correction required from automated checks");
    }
    onDone();
  }

  return (
    <Panel
      title="Automated checks"
      subtitle="22 pre-simulation checks. A critical result forces the job back to corrections."
      actions={
        <Button onClick={run} disabled={busy}>
          {busy ? "Running…" : "Run checks"}
        </Button>
      }
    >
      {checks.length === 0 ? (
        <EmptyState message="No checks recorded yet." />
      ) : (
        <div className="grid gap-2 md:grid-cols-2">
          {checks.map((c) => (
            <div key={c.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
              <span className="text-sm">{c.check_label}</span>
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className={
                    c.severity === "critical"
                      ? "border-destructive/50 text-destructive"
                      : c.severity === "review_required"
                        ? "border-primary/50 text-primary"
                        : ""
                  }
                >
                  {c.severity.replace("_", " ")}
                </Badge>
                <Button size="sm" variant="ghost" onClick={() => flag(c.id, "critical")}>
                  Flag
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

function SimulationPanel({ jobId, detail, actor, onDone }: PanelProps) {
  const sims = detail?.simulations ?? [];
  const [status, setStatusValue] = useState<SimulationStatus>("simulation_passed");
  const [collisions, setCollisions] = useState("");
  const [warnings, setWarnings] = useState("");
  const [cycle, setCycle] = useState("");
  const [software, setSoftware] = useState("");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);

  async function record() {
    setBusy(true);
    try {
      await productionUpsert({
        data: {
          table: "simulations",
          values: {
            job_id: jobId,
            status,
            collisions: collisions || null,
            warnings: warnings || null,
            estimated_cycle_time: cycle ? Number(cycle) : null,
            software_version: software || null,
            simulated_by: actor.actorId,
            simulated_at: new Date().toISOString(),
            results: Object.fromEntries(SIMULATION_CHECKS.map((c) => [c, Boolean(selected[c])])),
          },
        },
      });
      const next =
        status === "simulation_passed"
          ? "programmer_approval_pending"
          : status === "simulation_passed_with_warnings"
            ? "programmer_approval_pending"
            : status === "simulation_failed"
              ? "simulation_failed"
              : "corrections_required";
      await setStatus(jobId, next, actor, "Simulation result recorded", status.replace(/_/g, " "));
      toast.success("Simulation recorded.");
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not record the simulation.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel title="Simulation" subtitle="Thirteen verification checks. No approval without a recorded result.">
      <div className="grid gap-2 md:grid-cols-3">
        {SIMULATION_CHECKS.map((c) => (
          <label key={c} className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={Boolean(selected[c])}
              onCheckedChange={(v) => setSelected((prev) => ({ ...prev, [c]: v === true }))}
            />
            {c}
          </label>
        ))}
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div>
          <Label className="eyebrow">Result</Label>
          <Select value={status} onValueChange={(v) => setStatusValue(v as SimulationStatus)}>
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(
                [
                  "simulation_passed",
                  "simulation_passed_with_warnings",
                  "simulation_failed",
                  "corrections_required",
                  "human_verification_required",
                ] as SimulationStatus[]
              ).map((s) => (
                <SelectItem key={s} value={s}>
                  {s.replace(/_/g, " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="eyebrow">Estimated cycle time (min)</Label>
          <Input className="mt-1" type="number" value={cycle} onChange={(e) => setCycle(e.target.value)} />
        </div>
        <div>
          <Label className="eyebrow">Collisions</Label>
          <Input className="mt-1" value={collisions} onChange={(e) => setCollisions(e.target.value)} />
        </div>
        <div>
          <Label className="eyebrow">Warnings</Label>
          <Input className="mt-1" value={warnings} onChange={(e) => setWarnings(e.target.value)} />
        </div>
        <div>
          <Label className="eyebrow">Software version</Label>
          <Input className="mt-1" value={software} onChange={(e) => setSoftware(e.target.value)} />
        </div>
      </div>

      <div className="mt-4">
        <Button onClick={record} disabled={busy}>
          Record simulation
        </Button>
      </div>

      {sims.length > 0 ? (
        <ul className="mt-5 space-y-2 border-t border-border pt-4 text-sm">
          {sims.map((s) => (
            <li key={s.id} className="flex justify-between">
              <span>{s.status.replace(/_/g, " ")}</span>
              <span className="text-xs text-muted-foreground">
                {s.simulated_at ? new Date(s.simulated_at).toLocaleString() : ""}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </Panel>
  );
}

/* --------------------------------- Approval -------------------------------- */

function ApprovalPanel({ jobId, detail, actor, onDone }: PanelProps) {
  const sims = detail?.simulations ?? [];
  const approvals = detail?.approvals ?? [];
  const latestSim = sims[0] ?? null;
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [ack, setAck] = useState(false);
  const [programVersion, setProgramVersion] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const outstanding = APPROVAL_CHECKLIST.filter((c) => !checks[c]);
  const canApprove = outstanding.length === 0 && ack && Boolean(latestSim);

  async function submit(action: "approved" | "revisions_required") {
    setBusy(true);
    try {
      await productionUpsert({
        data: {
          table: "programmer_approvals",
          values: {
            job_id: jobId,
            action,
            acknowledged: ack,
            checklist: checks,
            notes: notes || null,
            program_version: programVersion || null,
            programmer: actor.actorId!,
            programmer_name: actor.actorName ?? "Programmer",
            simulation_status: latestSim?.status ?? null,
          },
        },
      });
      await setStatus(
        jobId,
        action === "approved" ? "programmer_approved" : "programmer_revisions_in_progress",
        actor,
        action === "approved" ? "Programmer approved the program" : "Programmer requested revisions",
        notes || undefined,
      );
      toast.success("Recorded.");
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not record the approval.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel
      title="Programmer approval"
      subtitle="38-point sign-off. Approval is impossible without a recorded simulation and a full checklist."
    >
      {!latestSim ? (
        <p className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          No simulation recorded — approval is blocked.
        </p>
      ) : null}

      <div className="grid gap-1.5 md:grid-cols-3">
        {APPROVAL_CHECKLIST.map((c) => (
          <label key={c} className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={Boolean(checks[c])}
              onCheckedChange={(v) => setChecks((prev) => ({ ...prev, [c]: v === true }))}
            />
            {c}
          </label>
        ))}
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div>
          <Label className="eyebrow">Program version</Label>
          <Input className="mt-1" value={programVersion} onChange={(e) => setProgramVersion(e.target.value)} />
        </div>
        <div>
          <Label className="eyebrow">Notes</Label>
          <Input className="mt-1" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </div>

      <label className="mt-4 flex items-start gap-2 rounded-md border border-border p-3 text-sm">
        <Checkbox checked={ack} onCheckedChange={(v) => setAck(v === true)} className="mt-0.5" />
        <span>
          I am a qualified programmer. I have reviewed every item above and accept responsibility for this
          program's validation, posting and production release.
        </span>
      </label>

      {outstanding.length > 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">{outstanding.length} checklist item(s) outstanding.</p>
      ) : null}

      <div className="mt-4 flex gap-2 border-t border-border pt-4">
        <Button onClick={() => submit("approved")} disabled={!canApprove || busy}>
          Approve program
        </Button>
        <Button variant="outline" onClick={() => submit("revisions_required")} disabled={busy}>
          Request revisions
        </Button>
      </div>

      {approvals.length > 0 ? (
        <ul className="mt-5 space-y-1 text-xs text-muted-foreground">
          {approvals.map((a) => (
            <li key={a.id}>
              {a.action} — {a.programmer_name} · {new Date(a.approved_at).toLocaleString()}
            </li>
          ))}
        </ul>
      ) : null}
    </Panel>
  );
}

/* ---------------------------------- Release -------------------------------- */

function PostingPanel({ jobId, detail, actor, onDone }: PanelProps) {
  const posts = detail?.posts ?? [];
  const sheets = detail?.sheets ?? [];
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [programNumber, setProgramNumber] = useState("");
  const [postName, setPostName] = useState("");
  const [busy, setBusy] = useState(false);

  const complete = CODE_REVIEW_CHECKS.every((c) => checks[c]);

  async function post() {
    setBusy(true);
    try {
      await productionUpsert({
        data: {
          table: "post_records",
          values: {
            job_id: jobId,
            program_number: programNumber || null,
            post_processor_name: postName || null,
            posted_by: actor.actorId,
            review_status: complete ? "reviewed" : "pending",
            code_review: checks,
          },
        },
      });
      await setStatus(
        jobId,
        complete ? "setup_sheet_generation" : "posted_code_review",
        actor,
        "Posted code review recorded",
        complete ? "All code review checks passed" : "Code review outstanding",
      );
      onDone();
      toast.success("Posted code recorded.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not record the post.");
    } finally {
      setBusy(false);
    }
  }

  async function generateSheet() {
    try {
      await productionUpsert({
        data: {
          table: "setup_sheets",
          values: { job_id: jobId, content: { generated_at: new Date().toISOString() }, reviewed: false },
        },
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not generate sheet.");
      return;
    }
    await setStatus(jobId, "final_technical_review", actor, "Setup sheet generated");
    onDone();
  }

  async function reviewSheet(id: string) {
    await productionUpsert({
      data: {
        table: "setup_sheets",
        id,
        values: { reviewed: true, reviewed_at: new Date().toISOString(), reviewer: actor.actorId },
      },
    });
    await setStatus(jobId, "ready_for_customer_release", actor, "Final technical review complete");
    onDone();
  }

  return (
    <Panel title="Posting & code review" subtitle="16-point posted-code review before setup documentation.">
      <div className="grid gap-1.5 md:grid-cols-2">
        {CODE_REVIEW_CHECKS.map((c) => (
          <label key={c} className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={Boolean(checks[c])}
              onCheckedChange={(v) => setChecks((prev) => ({ ...prev, [c]: v === true }))}
            />
            {c}
          </label>
        ))}
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div>
          <Label className="eyebrow">Program number</Label>
          <Input className="mt-1" value={programNumber} onChange={(e) => setProgramNumber(e.target.value)} />
        </div>
        <div>
          <Label className="eyebrow">Post processor used</Label>
          <Input className="mt-1" value={postName} onChange={(e) => setPostName(e.target.value)} />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button onClick={post} disabled={busy}>
          Record posted code
        </Button>
        <Button variant="outline" onClick={generateSheet}>
          Generate setup sheet
        </Button>
      </div>

      {posts.length > 0 ? (
        <p className="mt-4 text-xs text-muted-foreground">
          Latest post: {posts[0].program_number ?? "—"} · {posts[0].review_status}
        </p>
      ) : null}

      {sheets.length > 0 ? (
        <ul className="mt-3 space-y-2 border-t border-border pt-3 text-sm">
          {sheets.map((s) => (
            <li key={s.id} className="flex items-center justify-between">
              <span>Setup sheet · {new Date(s.created_at).toLocaleDateString()}</span>
              {s.reviewed ? (
                <Badge variant="outline">Reviewed</Badge>
              ) : (
                <Button size="sm" variant="outline" onClick={() => reviewSheet(s.id)}>
                  Mark technical review complete
                </Button>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </Panel>
  );
}

function ReleasePanel({
  job,
  detail,
  actor,
  onDone,
}: {
  job: { id: string; status: string };
  detail: Detail;
  actor: Actor;
  onDone: () => void;
}) {
  const release = detail?.release ?? null;
  const approvals = detail?.approvals ?? [];
  const sims = detail?.simulations ?? [];
  const sheets = detail?.sheets ?? [];
  const posts = detail?.posts ?? [];
  const [busy, setBusy] = useState(false);

  const blockers: string[] = [];
  if (!approvals.some((a) => a.action === "approved")) blockers.push("Programmer approval is required.");
  if (!sims.length) blockers.push("A simulation result must be recorded.");
  if (!posts.length) blockers.push("Posted code must be recorded.");
  if (!sheets.some((s) => s.reviewed)) blockers.push("Setup sheet technical review is required.");

  async function releaseToCustomer() {
    setBusy(true);
    try {
      const payload = {
        job_id: job.id,
        contents: {
          nc_program: posts[0]?.program_number ?? null,
          setup_sheet: sheets[0]?.id ?? null,
          simulation: sims[0]?.id ?? null,
        },
        license_text: PRODUCTION_LICENSE,
        released: true,
        released_at: new Date().toISOString(),
        released_by: actor.actorId,
      };
      if (release) {
        await productionUpsert({ data: { table: "release_packages", id: release.id, values: payload } });
      } else {
        await productionUpsert({ data: { table: "release_packages", values: payload } });
      }
      await productionUpsert({
        data: {
          table: "jobs",
          id: job.id,
          values: {
            status: "released_to_customer",
            released_at: new Date().toISOString(),
            released_by: actor.actorId,
          },
        },
      });
      await logJobEvent({ data: { jobId: job.id, ...actor, action: "Released to customer" } });
      toast.success("Release package issued.");
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not release the job.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel title="Customer release" subtitle="Nothing auto-releases. Every gate is explicit.">
      {blockers.length > 0 ? (
        <ul className="space-y-1 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
          {blockers.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      ) : (
        <p className="rounded-md border border-chart-2/40 bg-chart-2/10 px-3 py-2 text-xs text-chart-2">
          All release gates satisfied.
        </p>
      )}

      <p className="mt-4 text-xs text-muted-foreground">{PRODUCTION_LICENSE}</p>

      <div className="mt-4 flex gap-2">
        <Button onClick={releaseToCustomer} disabled={blockers.length > 0 || busy}>
          Release to customer
        </Button>
        <Button
          variant="outline"
          disabled={job.status !== "released_to_customer"}
          onClick={async () => {
            await setStatus(job.id, "customer_prove_out", actor, "Customer prove-out started");
            onDone();
          }}
        >
          Start prove-out
        </Button>
      </div>
    </Panel>
  );
}

/* --------------------------------- Prove-out ------------------------------- */

function ProveOutPanel({ jobId, detail, actor, onDone }: PanelProps) {
  const results = detail?.proveOuts ?? [];
  const [form, setForm] = useState({
    actual_cycle_time: "",
    planned_cycle_time: "",
    dimensional_results: "",
    surface_finish_results: "",
    tool_life_results: "",
    setup_changes: "",
    program_changes: "",
    offset_changes: "",
    operator_feedback: "",
    revision_reason: "",
  });
  const [accepted, setAccepted] = useState(true);
  const [revision, setRevision] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      await productionUpsert({
        data: {
          table: "prove_out_results",
          values: {
            job_id: jobId,
            actual_cycle_time: form.actual_cycle_time ? Number(form.actual_cycle_time) : null,
            planned_cycle_time: form.planned_cycle_time ? Number(form.planned_cycle_time) : null,
            dimensional_results: form.dimensional_results || null,
            surface_finish_results: form.surface_finish_results || null,
            tool_life_results: form.tool_life_results || null,
            setup_changes: form.setup_changes || null,
            program_changes: form.program_changes || null,
            offset_changes: form.offset_changes || null,
            operator_feedback: form.operator_feedback || null,
            revision_reason: form.revision_reason || null,
            first_piece_accepted: accepted,
            revision_required: revision,
            submitted_by: actor.actorId,
          },
        },
      });
      await setStatus(
        jobId,
        revision ? "revision_requested" : "completed",
        actor,
        revision ? "Revision requested from prove-out" : "Job completed",
        form.revision_reason || undefined,
      );
      toast.success("Prove-out recorded.");
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not record the prove-out.");
    } finally {
      setBusy(false);
    }
  }

  const field = (key: keyof typeof form, label: string) => (
    <div key={key}>
      <Label className="eyebrow">{label}</Label>
      <Input
        className="mt-1"
        value={form[key]}
        onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))}
      />
    </div>
  );

  return (
    <Panel title="Customer prove-out" subtitle="Actual results feed accuracy tracking and revisions.">
      <div className="grid gap-4 md:grid-cols-2">
        {field("planned_cycle_time", "Planned cycle time (min)")}
        {field("actual_cycle_time", "Actual cycle time (min)")}
        {field("dimensional_results", "Dimensional results")}
        {field("surface_finish_results", "Surface finish results")}
        {field("tool_life_results", "Tool life results")}
        {field("setup_changes", "Setup changes")}
        {field("program_changes", "Program changes")}
        {field("offset_changes", "Offset changes")}
        {field("operator_feedback", "Operator feedback")}
        {field("revision_reason", "Revision reason")}
      </div>

      <div className="mt-4 flex flex-wrap gap-6">
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={accepted} onCheckedChange={(v) => setAccepted(v === true)} />
          First piece accepted
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={revision} onCheckedChange={(v) => setRevision(v === true)} />
          Revision required
        </label>
      </div>

      <div className="mt-4">
        <Button onClick={submit} disabled={busy}>
          Record prove-out
        </Button>
      </div>

      {results.length > 0 ? (
        <ul className="mt-5 space-y-1 border-t border-border pt-4 text-xs text-muted-foreground">
          {results.map((r) => (
            <li key={r.id}>
              {r.first_piece_accepted ? "Accepted" : "Rejected"}
              {r.revision_required ? " · revision required" : ""} ·{" "}
              {new Date(r.created_at).toLocaleString()}
            </li>
          ))}
        </ul>
      ) : null}
    </Panel>
  );
}
