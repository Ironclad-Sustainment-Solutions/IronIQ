import { useState } from "react";
import { Panel, EmptyState } from "@/components/ironiq/layout-primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SeverityBadge } from "@/components/ironiq/badges";
import {
  AiBadge,
  ClassificationBadge,
  ConfidenceBadge,
  FieldLabel,
  SourceBadge,
} from "./shared";
import {
  CONFIDENCE_LABELS,
  DIMENSIONS,
  EVIDENCE_TYPE_LABELS,
  FINDING_CLASS_LABELS,
  SOURCE_LABELS,
  type CapConfidence,
  type CapDomainRow,
  type CapEvidenceRow,
  type CapFindingClass,
  type CapFindingLinkRow,
  type CapFindingRow,
  type CapRootGapRow,
  type CapSeverity,
  type CapSource,
} from "@/lib/capability-domain";
import {
  useApproveFinding,
  useCapDelete,
  useCapUpsert,
} from "@/lib/capability-api";
import { suggestConstraints } from "@/lib/capability-ai.functions";
import { toast } from "sonner";
import { Check, Link2, Loader2, Plus, Sparkles, Trash2 } from "lucide-react";

const SEVERITIES: CapSeverity[] = [
  "critical",
  "high",
  "medium",
  "low",
  "opportunity",
];
const CLASSES = Object.keys(FINDING_CLASS_LABELS) as CapFindingClass[];
const CONFIDENCES = Object.keys(CONFIDENCE_LABELS) as CapConfidence[];

export function FindingsPanel({
  assessmentId,
  domains,
  findings,
  evidence,
  links,
  gaps,
  aiContext,
}: {
  assessmentId: string;
  domains: CapDomainRow[];
  findings: CapFindingRow[];
  evidence: CapEvidenceRow[];
  links: CapFindingLinkRow[];
  gaps: CapRootGapRow[];
  aiContext: string;
}) {
  const upsert = useCapUpsert<Record<string, unknown>>(
    assessmentId,
    "cap_findings",
    {
      successMessage: "Finding saved",
    },
  );
  const remove = useCapDelete(assessmentId, "cap_findings", "Finding removed");
  const approve = useApproveFinding(assessmentId);
  const [busy, setBusy] = useState(false);

  const domainById = new Map(domains.map((d) => [d.id, d]));
  const domainByCode = new Map(domains.map((d) => [d.code, d]));

  async function runAi() {
    setBusy(true);
    try {
      const out = (await suggestConstraints({
        data: { context: aiContext },
      })) as {
        possible_constraints: {
          title: string;
          rationale: string;
          domain_code: string;
          dimension: string;
          classification: CapFindingClass;
          evidence_needed: string;
        }[];
        suspected_root_gap: string;
      };
      for (const c of out.possible_constraints ?? []) {
        upsert.mutate({
          assessment_id: assessmentId,
          title: c.title,
          finding_text: c.rationale,
          domain_id: domainByCode.get(c.domain_code)?.id ?? null,
          dimension: c.dimension,
          classification: c.classification,
          confidence: "low",
          source: "ironclad_validated",
          assessor_notes: `Evidence required: ${c.evidence_needed}`,
          ai_generated: true,
          approved: false,
        });
      }
      toast.success("AI suggestions added as unapproved drafts");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "AI assistance unavailable");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6">
      <Panel
        title="Findings & Constraints"
        subtitle="Each finding records what was observed, the evidence behind it and how confident the assessor is."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={runAi} disabled={busy}>
              {busy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4" />
              )}
              Suggest constraints
            </Button>
            <Button
              onClick={() =>
                upsert.mutate({
                  assessment_id: assessmentId,
                  title: "New finding",
                  classification: "risk",
                })
              }
            >
              <Plus className="size-4" /> Add finding
            </Button>
          </div>
        }
      >
        {findings.length === 0 ? (
          <EmptyState message="No findings recorded yet." />
        ) : (
          <div className="grid gap-4">
            {findings.map((f) => (
              <FindingCard
                key={f.id}
                assessmentId={assessmentId}
                finding={f}
                domains={domains}
                evidence={evidence.filter((e) => e.finding_id === f.id)}
                links={links.filter((l) => l.parent_finding_id === f.id)}
                otherFindings={findings.filter((o) => o.id !== f.id)}
                domainById={domainById}
                onSave={(values) =>
                  upsert.mutate({
                    id: f.id,
                    assessment_id: assessmentId,
                    ...values,
                  })
                }
                onDelete={() => remove.mutate(f.id)}
                onApprove={(approved) => approve.mutate({ id: f.id, approved })}
              />
            ))}
          </div>
        )}
      </Panel>

      <RootGapsPanel
        assessmentId={assessmentId}
        domains={domains}
        gaps={gaps}
        findings={findings}
      />
    </div>
  );
}

function FindingCard({
  assessmentId,
  finding,
  domains,
  evidence,
  links,
  otherFindings,
  domainById,
  onSave,
  onDelete,
  onApprove,
}: {
  assessmentId: string;
  finding: CapFindingRow;
  domains: CapDomainRow[];
  evidence: CapEvidenceRow[];
  links: CapFindingLinkRow[];
  otherFindings: CapFindingRow[];
  domainById: Map<string, CapDomainRow>;
  onSave: (values: Record<string, unknown>) => void;
  onDelete: () => void;
  onApprove: (approved: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({
    title: finding.title,
    finding_text: finding.finding_text ?? "",
    domain_id: finding.domain_id ?? "",
    dimension: finding.dimension ?? "",
    classification: finding.classification,
    severity: finding.severity,
    confidence: finding.confidence,
    source: finding.source,
    assessor_notes: finding.assessor_notes ?? "",
    client_visible: finding.client_visible,
  });
  const set = (k: keyof typeof v, val: unknown) =>
    setV((s) => ({ ...s, [k]: val }));

  const addEvidence = useCapUpsert<Record<string, unknown>>(
    assessmentId,
    "cap_evidence",
    {
      successMessage: "Evidence added",
    },
  );
  const removeEvidence = useCapDelete(
    assessmentId,
    "cap_evidence",
    "Evidence removed",
  );
  const addLink = useCapUpsert<Record<string, unknown>>(
    assessmentId,
    "cap_finding_links",
    {
      successMessage: "Relationship added",
    },
  );
  const removeLink = useCapDelete(
    assessmentId,
    "cap_finding_links",
    "Relationship removed",
  );

  return (
    <div className="rounded-md border border-border">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full flex-wrap items-center gap-2 p-4 text-left"
      >
        <span className="min-w-48 flex-1 text-sm font-medium text-foreground">
          {finding.title}
        </span>
        {finding.ai_generated ? <AiBadge label="AI draft" /> : null}
        <SourceBadge value={finding.source} />
        <ClassificationBadge value={finding.classification} />
        <SeverityBadge severity={finding.severity} />
        <ConfidenceBadge value={finding.confidence} />
        {finding.approved ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-widest text-success">
            <Check className="size-3" /> Approved
          </span>
        ) : (
          <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Unapproved
          </span>
        )}
      </button>

      {open ? (
        <div className="space-y-4 border-t border-border p-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="md:col-span-2">
              <FieldLabel>Finding</FieldLabel>
              <Input
                className="mt-1.5"
                value={v.title}
                onChange={(e) => set("title", e.target.value)}
              />
            </div>
            <div className="md:col-span-2">
              <FieldLabel>Detail</FieldLabel>
              <Textarea
                className="mt-1.5 min-h-20"
                value={v.finding_text}
                onChange={(e) => set("finding_text", e.target.value)}
              />
            </div>
            <Choice
              label="Capability domain"
              value={v.domain_id}
              onChange={(x) => set("domain_id", x)}
              options={domains.map((d) => ({ value: d.id, label: d.name }))}
            />
            <Choice
              label="Performance dimension"
              value={v.dimension}
              onChange={(x) => set("dimension", x)}
              options={DIMENSIONS.map((d) => ({
                value: d.key,
                label: d.label,
              }))}
            />
            <Choice
              label="Classification"
              value={v.classification}
              onChange={(x) => set("classification", x)}
              options={CLASSES.map((c) => ({
                value: c,
                label: FINDING_CLASS_LABELS[c],
              }))}
            />
            <Choice
              label="Severity"
              value={v.severity}
              onChange={(x) => set("severity", x)}
              options={SEVERITIES.map((s) => ({ value: s, label: s }))}
            />
            <Choice
              label="Confidence level"
              value={v.confidence}
              onChange={(x) => set("confidence", x)}
              options={CONFIDENCES.map((c) => ({
                value: c,
                label: CONFIDENCE_LABELS[c],
              }))}
            />
            <Choice
              label="Source"
              value={v.source}
              onChange={(x) => set("source", x as CapSource)}
              options={(Object.keys(SOURCE_LABELS) as CapSource[]).map((s) => ({
                value: s,
                label: SOURCE_LABELS[s],
              }))}
            />
            <div className="md:col-span-2">
              <FieldLabel>Assessor notes</FieldLabel>
              <Textarea
                className="mt-1.5 min-h-16"
                value={v.assessor_notes}
                onChange={(e) => set("assessor_notes", e.target.value)}
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={v.client_visible}
                onChange={(e) => set("client_visible", e.target.checked)}
              />
              Visible to client
            </label>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={() =>
                onSave({
                  ...v,
                  domain_id: v.domain_id || null,
                  dimension: v.dimension || null,
                })
              }
            >
              Save finding
            </Button>
            <Button
              size="sm"
              variant={finding.approved ? "outline" : "default"}
              onClick={() => onApprove(!finding.approved)}
            >
              {finding.approved
                ? "Revoke approval"
                : "Approve as official finding"}
            </Button>
            <Button size="sm" variant="ghost" onClick={onDelete}>
              <Trash2 className="size-4" /> Delete
            </Button>
          </div>

          <EvidenceList
            evidence={evidence}
            onAdd={(values) =>
              addEvidence.mutate({ finding_id: finding.id, ...values })
            }
            onRemove={(id) => removeEvidence.mutate(id)}
          />

          <div>
            <FieldLabel>Causal chain — this finding is explained by</FieldLabel>
            <ul className="mt-2 space-y-1 text-sm">
              {links.map((l) => {
                const child = otherFindings.find(
                  (f) => f.id === l.child_finding_id,
                );
                return (
                  <li key={l.id} className="flex items-center gap-2">
                    <Link2 className="size-3.5 text-muted-foreground" />
                    <span className="flex-1">
                      {child?.title ?? "Unknown finding"}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removeLink.mutate(l.id)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </li>
                );
              })}
              {links.length === 0 ? (
                <li className="text-muted-foreground">No linked findings.</li>
              ) : null}
            </ul>
            {otherFindings.length > 0 ? (
              <Select
                value=""
                onValueChange={(child) =>
                  addLink.mutate({
                    parent_finding_id: finding.id,
                    child_finding_id: child,
                    relation: "caused_by",
                  })
                }
              >
                <SelectTrigger className="mt-2 w-72">
                  <SelectValue placeholder="Link a contributing finding" />
                </SelectTrigger>
                <SelectContent>
                  {otherFindings.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">
            Domain:{" "}
            {finding.domain_id
              ? (domainById.get(finding.domain_id)?.name ?? "—")
              : "—"}
          </p>
        </div>
      ) : null}
    </div>
  );
}

function EvidenceList({
  evidence,
  onAdd,
  onRemove,
}: {
  evidence: CapEvidenceRow[];
  onAdd: (values: Record<string, unknown>) => void;
  onRemove: (id: string) => void;
}) {
  const [type, setType] = useState("direct_observation");
  const [description, setDescription] = useState("");
  const [source, setSource] = useState("");

  return (
    <div className="rounded-md border border-dashed border-border p-3">
      <FieldLabel>Evidence</FieldLabel>
      <ul className="mt-2 space-y-1 text-sm">
        {evidence.map((e) => (
          <li key={e.id} className="flex items-center gap-2">
            <span className="font-display text-[11px] uppercase tracking-widest text-primary">
              {EVIDENCE_TYPE_LABELS[e.evidence_type]}
            </span>
            <span className="flex-1">{e.description}</span>
            <span className="text-xs text-muted-foreground">{e.source}</span>
            <Button size="sm" variant="ghost" onClick={() => onRemove(e.id)}>
              <Trash2 className="size-3.5" />
            </Button>
          </li>
        ))}
        {evidence.length === 0 ? (
          <li className="text-muted-foreground">No evidence attached.</li>
        ) : null}
      </ul>
      <div className="mt-3 grid gap-2 sm:grid-cols-[12rem_1fr_12rem_auto]">
        <Select value={type} onValueChange={setType}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(EVIDENCE_TYPE_LABELS).map(([k, label]) => (
              <SelectItem key={k} value={k}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          placeholder="What was observed or reviewed"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <Input
          placeholder="Source"
          value={source}
          onChange={(e) => setSource(e.target.value)}
        />
        <Button
          variant="outline"
          onClick={() => {
            if (!description.trim()) return;
            onAdd({ evidence_type: type, description, source });
            setDescription("");
            setSource("");
          }}
        >
          <Plus className="size-4" /> Add
        </Button>
      </div>
    </div>
  );
}

function RootGapsPanel({
  assessmentId,
  domains,
  gaps,
  findings,
}: {
  assessmentId: string;
  domains: CapDomainRow[];
  gaps: CapRootGapRow[];
  findings: CapFindingRow[];
}) {
  const upsert = useCapUpsert<Record<string, unknown>>(
    assessmentId,
    "cap_root_gaps",
    {
      successMessage: "Root capability gap saved",
    },
  );
  const remove = useCapDelete(
    assessmentId,
    "cap_root_gaps",
    "Root capability gap removed",
  );

  return (
    <Panel
      title="Root Capability Gap"
      subtitle="A gap is only claimed as root cause when the evidence supports it. Otherwise it stays suspected and requires validation."
      actions={
        <Button
          onClick={() =>
            upsert.mutate({
              assessment_id: assessmentId,
              observed_problem: "Observed performance problem",
              root_gap: "Suspected root capability gap",
            })
          }
        >
          <Plus className="size-4" /> Add gap
        </Button>
      }
    >
      {gaps.length === 0 ? (
        <EmptyState message="No root capability gaps identified yet." />
      ) : (
        <div className="grid gap-4">
          {gaps.map((g) => (
            <GapCard
              key={g.id}
              gap={g}
              domains={domains}
              findings={findings}
              onSave={(values) =>
                upsert.mutate({
                  id: g.id,
                  assessment_id: assessmentId,
                  ...values,
                })
              }
              onDelete={() => remove.mutate(g.id)}
            />
          ))}
        </div>
      )}
    </Panel>
  );
}

function GapCard({
  gap,
  domains,
  findings,
  onSave,
  onDelete,
}: {
  gap: CapRootGapRow;
  domains: CapDomainRow[];
  findings: CapFindingRow[];
  onSave: (values: Record<string, unknown>) => void;
  onDelete: () => void;
}) {
  const [v, setV] = useState({
    observed_problem: gap.observed_problem,
    immediate_cause: gap.immediate_cause ?? "",
    contributing_factors: gap.contributing_factors ?? "",
    root_gap: gap.root_gap,
    domain_id: gap.domain_id ?? "",
    dimension: gap.dimension ?? "",
    operational_consequence: gap.operational_consequence ?? "",
    confidence: gap.confidence,
    validated: gap.validated,
    primary_finding_id: gap.primary_finding_id ?? "",
  });
  const set = (k: keyof typeof v, val: unknown) =>
    setV((s) => ({ ...s, [k]: val }));

  return (
    <div className="rounded-md border border-border p-4">
      {!v.validated ? (
        <p className="mb-3 inline-flex rounded-sm border border-high/50 bg-high/15 px-2 py-0.5 font-display text-[11px] font-semibold uppercase tracking-widest text-high">
          Suspected root capability gap — validation required
        </p>
      ) : null}
      <div className="grid gap-3 md:grid-cols-2">
        {(
          [
            ["observed_problem", "Observed performance problem"],
            ["immediate_cause", "Immediate cause"],
            ["contributing_factors", "Contributing factors"],
            ["root_gap", "Root capability gap"],
            ["operational_consequence", "Operational consequence"],
          ] as const
        ).map(([key, label]) => (
          <div
            key={key}
            className={key === "root_gap" ? "md:col-span-2" : undefined}
          >
            <FieldLabel>{label}</FieldLabel>
            <Textarea
              className="mt-1.5 min-h-16"
              value={v[key]}
              onChange={(e) => set(key, e.target.value)}
            />
          </div>
        ))}
        <Choice
          label="Capability domain"
          value={v.domain_id}
          onChange={(x) => set("domain_id", x)}
          options={domains.map((d) => ({ value: d.id, label: d.name }))}
        />
        <Choice
          label="Performance dimension"
          value={v.dimension}
          onChange={(x) => set("dimension", x)}
          options={DIMENSIONS.map((d) => ({ value: d.key, label: d.label }))}
        />
        <Choice
          label="Confidence"
          value={v.confidence}
          onChange={(x) => set("confidence", x)}
          options={CONFIDENCES.map((c) => ({
            value: c,
            label: CONFIDENCE_LABELS[c],
          }))}
        />
        <Choice
          label="Primary supporting finding"
          value={v.primary_finding_id}
          onChange={(x) => set("primary_finding_id", x)}
          options={findings.map((f) => ({ value: f.id, label: f.title }))}
        />
      </div>
      <label className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
        <input
          type="checkbox"
          checked={v.validated}
          onChange={(e) => set("validated", e.target.checked)}
        />
        Evidence is sufficient — treat as validated root capability gap
      </label>
      <div className="mt-3 flex gap-2">
        <Button
          size="sm"
          onClick={() =>
            onSave({
              ...v,
              domain_id: v.domain_id || null,
              dimension: v.dimension || null,
              primary_finding_id: v.primary_finding_id || null,
            })
          }
        >
          Save
        </Button>
        <Button size="sm" variant="ghost" onClick={onDelete}>
          <Trash2 className="size-4" /> Delete
        </Button>
      </div>
    </div>
  );
}

export function Choice({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="mt-1.5">
          <SelectValue placeholder="Select" />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
