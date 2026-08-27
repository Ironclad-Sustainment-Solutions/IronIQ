import { useEffect, useState } from "react";
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
import { AiBadge, FieldLabel } from "./shared";
import {
  INTAKE_QUESTIONS,
  PERF_CATEGORIES,
  PERF_CATEGORY_LABELS,
  type CapImpactRow,
  type CapPerfCategory,
  type CapProblemRow,
} from "@/lib/capability-domain";
import { useCapDelete, useCapUpsert } from "@/lib/capability-api";
import { summarizeIntake } from "@/lib/capability-ai.functions";
import { toast } from "sonner";
import { Loader2, Plus, Sparkles, Trash2 } from "lucide-react";

type SummaryDraft = {
  stated_problem: string;
  location_process: string;
  performance_impact: string;
  previous_actions: string;
  desired_outcome: string;
  suggested_domains: string[];
  follow_up_questions: string[];
};

export function IntakePanel({
  assessmentId,
  problem,
  impacts,
}: {
  assessmentId: string;
  problem: CapProblemRow | null;
  impacts: CapImpactRow[];
}) {
  const saveProblem = useCapUpsert<Record<string, unknown>>(
    assessmentId,
    "cap_problems",
    {
      successMessage: "Intake saved",
    },
  );
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [aiDraft, setAiDraft] = useState<SummaryDraft | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setDraft({
      q_greatest_impact: problem?.q_greatest_impact ?? "",
      q_where_when: problem?.q_where_when ?? "",
      q_effect: problem?.q_effect ?? "",
      q_tried: problem?.q_tried ?? "",
      q_if_resolved: problem?.q_if_resolved ?? "",
      stated_problem: problem?.stated_problem ?? "",
      location_process: problem?.location_process ?? "",
      performance_impact: problem?.performance_impact ?? "",
      previous_actions: problem?.previous_actions ?? "",
      desired_outcome: problem?.desired_outcome ?? "",
      entered_by_role: problem?.entered_by_role ?? "assessor",
    });
  }, [problem]);

  const set = (key: string, value: string) =>
    setDraft((d) => ({ ...d, [key]: value }));

  async function runAi() {
    setBusy(true);
    try {
      const out = (await summarizeIntake({
        data: {
          q_greatest_impact: draft["q_greatest_impact"] ?? "",
          q_where_when: draft["q_where_when"] ?? "",
          q_effect: draft["q_effect"] ?? "",
          q_tried: draft["q_tried"] ?? "",
          q_if_resolved: draft["q_if_resolved"] ?? "",
        },
      })) as SummaryDraft;
      setAiDraft(out);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "AI assistance unavailable");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6">
      <Panel
        title="Customer Problem Intake"
        subtitle="The stated problem is the starting point for investigation — it is never assumed to be the root cause."
        actions={
          <Select
            value={draft["entered_by_role"] ?? "assessor"}
            onValueChange={(v) => set("entered_by_role", v)}
          >
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="assessor">Entered by assessor</SelectItem>
              <SelectItem value="client">Entered by client</SelectItem>
            </SelectContent>
          </Select>
        }
      >
        <div className="grid gap-5">
          {INTAKE_QUESTIONS.map((q, i) => (
            <div key={q.key}>
              <FieldLabel>
                {i + 1}. {q.label}
              </FieldLabel>
              <Textarea
                className="mt-2 min-h-20"
                value={draft[q.key] ?? ""}
                onChange={(e) => set(q.key, e.target.value)}
              />
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() =>
                saveProblem.mutate({
                  id: problem?.id,
                  assessment_id: assessmentId,
                  ...draft,
                })
              }
              disabled={saveProblem.isPending}
            >
              Save intake
            </Button>
            <Button variant="outline" onClick={runAi} disabled={busy}>
              {busy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4" />
              )}
              Summarize with AI
            </Button>
          </div>
        </div>
      </Panel>

      {aiDraft ? (
        <Panel
          title="AI-drafted summary"
          subtitle="Review, edit and apply. Nothing is recorded until you apply it."
        >
          <div className="grid gap-4">
            <AiBadge />
            <dl className="grid gap-3 text-sm md:grid-cols-2">
              {(
                [
                  ["Stated Problem", aiDraft.stated_problem],
                  ["Location / Process Affected", aiDraft.location_process],
                  ["Performance Impact", aiDraft.performance_impact],
                  ["Previous Corrective Actions", aiDraft.previous_actions],
                  ["Desired Outcome", aiDraft.desired_outcome],
                ] as const
              ).map(([label, value]) => (
                <div key={label}>
                  <FieldLabel>{label}</FieldLabel>
                  <dd className="mt-1 text-foreground">{value}</dd>
                </div>
              ))}
            </dl>
            {aiDraft.follow_up_questions?.length ? (
              <div>
                <FieldLabel>Suggested follow-up questions</FieldLabel>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  {aiDraft.follow_up_questions.map((q) => (
                    <li key={q}>{q}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            <div className="flex gap-2">
              <Button
                onClick={() => {
                  setDraft((d) => ({
                    ...d,
                    stated_problem: aiDraft.stated_problem,
                    location_process: aiDraft.location_process,
                    performance_impact: aiDraft.performance_impact,
                    previous_actions: aiDraft.previous_actions,
                    desired_outcome: aiDraft.desired_outcome,
                  }));
                  setAiDraft(null);
                  toast.success(
                    "Applied to the summary fields — review before saving",
                  );
                }}
              >
                Apply to summary
              </Button>
              <Button variant="ghost" onClick={() => setAiDraft(null)}>
                Discard
              </Button>
            </div>
          </div>
        </Panel>
      ) : null}

      <Panel
        title="Assessor Summary"
        subtitle="Validated wording that carries into the capability review report."
      >
        <div className="grid gap-4 md:grid-cols-2">
          {(
            [
              ["stated_problem", "Stated Problem"],
              ["location_process", "Location / Process Affected"],
              ["performance_impact", "Performance Impact"],
              ["previous_actions", "Previous Corrective Actions"],
              ["desired_outcome", "Desired Outcome"],
            ] as const
          ).map(([key, label]) => (
            <div key={key}>
              <FieldLabel>{label}</FieldLabel>
              <Textarea
                className="mt-2 min-h-20"
                value={draft[key] ?? ""}
                onChange={(e) => set(key, e.target.value)}
              />
            </div>
          ))}
        </div>
        <div className="mt-4">
          <Button
            onClick={() =>
              saveProblem.mutate({
                id: problem?.id,
                assessment_id: assessmentId,
                ...draft,
              })
            }
            disabled={saveProblem.isPending}
          >
            Save summary
          </Button>
        </div>
      </Panel>

      <ImpactsPanel assessmentId={assessmentId} impacts={impacts} />
    </div>
  );
}

function ImpactsPanel({
  assessmentId,
  impacts,
}: {
  assessmentId: string;
  impacts: CapImpactRow[];
}) {
  const upsert = useCapUpsert<Record<string, unknown>>(
    assessmentId,
    "cap_performance_impacts",
    {
      successMessage: "Performance impact saved",
    },
  );
  const remove = useCapDelete(
    assessmentId,
    "cap_performance_impacts",
    "Performance impact removed",
  );
  const [adding, setAdding] = useState<CapPerfCategory | "">("");

  const used = new Set(impacts.map((i) => i.category));

  return (
    <Panel
      title="Performance Impact"
      subtitle="Which operational outcomes are affected, and by how much."
      actions={
        <div className="flex items-center gap-2">
          <Select
            value={adding}
            onValueChange={(v) => setAdding(v as CapPerfCategory)}
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Add category" />
            </SelectTrigger>
            <SelectContent>
              {PERF_CATEGORIES.filter((c) => !used.has(c)).map((c) => (
                <SelectItem key={c} value={c}>
                  {PERF_CATEGORY_LABELS[c]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            disabled={!adding}
            onClick={() => {
              if (!adding) return;
              upsert.mutate({ assessment_id: assessmentId, category: adding });
              setAdding("");
            }}
          >
            <Plus className="size-4" /> Add
          </Button>
        </div>
      }
    >
      {impacts.length === 0 ? (
        <EmptyState message="No performance outcomes selected yet. Add the categories this problem is affecting." />
      ) : (
        <div className="grid gap-4">
          {impacts.map((impact) => (
            <ImpactCard
              key={impact.id}
              impact={impact}
              onSave={(values) =>
                upsert.mutate({
                  id: impact.id,
                  assessment_id: assessmentId,
                  ...values,
                })
              }
              onDelete={() => remove.mutate(impact.id)}
            />
          ))}
        </div>
      )}
    </Panel>
  );
}

function ImpactCard({
  impact,
  onSave,
  onDelete,
}: {
  impact: CapImpactRow;
  onSave: (values: Record<string, unknown>) => void;
  onDelete: () => void;
}) {
  const [v, setV] = useState({
    current_condition: impact.current_condition ?? "",
    desired_condition: impact.desired_condition ?? "",
    metric_name: impact.metric_name ?? "",
    current_value: impact.current_value?.toString() ?? "",
    target_value: impact.target_value?.toString() ?? "",
    unit: impact.unit ?? "",
    data_source: impact.data_source ?? "",
    evidence: impact.evidence ?? "",
    assessor_notes: impact.assessor_notes ?? "",
  });
  const set = (k: keyof typeof v, val: string) =>
    setV((s) => ({ ...s, [k]: val }));

  return (
    <div className="rounded-md border border-border p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-sm font-semibold uppercase tracking-widest text-foreground">
          {PERF_CATEGORY_LABELS[impact.category]}
        </h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDelete}
          aria-label="Remove category"
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div>
          <FieldLabel>Current condition</FieldLabel>
          <Textarea
            className="mt-1.5 min-h-16"
            value={v.current_condition}
            onChange={(e) => set("current_condition", e.target.value)}
          />
        </div>
        <div>
          <FieldLabel>Desired condition</FieldLabel>
          <Textarea
            className="mt-1.5 min-h-16"
            value={v.desired_condition}
            onChange={(e) => set("desired_condition", e.target.value)}
          />
        </div>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <FieldLabel>Metric</FieldLabel>
          <Input
            className="mt-1.5"
            value={v.metric_name}
            onChange={(e) => set("metric_name", e.target.value)}
          />
        </div>
        <div>
          <FieldLabel>Current value</FieldLabel>
          <Input
            className="mt-1.5"
            inputMode="decimal"
            value={v.current_value}
            onChange={(e) => set("current_value", e.target.value)}
          />
        </div>
        <div>
          <FieldLabel>Target value</FieldLabel>
          <Input
            className="mt-1.5"
            inputMode="decimal"
            value={v.target_value}
            onChange={(e) => set("target_value", e.target.value)}
          />
        </div>
        <div>
          <FieldLabel>Unit</FieldLabel>
          <Input
            className="mt-1.5"
            value={v.unit}
            onChange={(e) => set("unit", e.target.value)}
          />
        </div>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <div>
          <FieldLabel>Data source</FieldLabel>
          <Input
            className="mt-1.5"
            value={v.data_source}
            onChange={(e) => set("data_source", e.target.value)}
          />
        </div>
        <div>
          <FieldLabel>Evidence</FieldLabel>
          <Input
            className="mt-1.5"
            value={v.evidence}
            onChange={(e) => set("evidence", e.target.value)}
          />
        </div>
        <div>
          <FieldLabel>Assessor notes</FieldLabel>
          <Input
            className="mt-1.5"
            value={v.assessor_notes}
            onChange={(e) => set("assessor_notes", e.target.value)}
          />
        </div>
      </div>
      <div className="mt-3">
        <Button
          size="sm"
          onClick={() =>
            onSave({
              ...v,
              current_value:
                v.current_value === "" ? null : Number(v.current_value),
              target_value:
                v.target_value === "" ? null : Number(v.target_value),
            })
          }
        >
          Save
        </Button>
      </div>
    </div>
  );
}
