import { useState } from "react";
import { Panel, EmptyState } from "@/components/ironiq/layout-primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  ActionStatusBadge,
  FieldLabel,
  PriorityBadge,
  ValidationBadge,
  AiBadge,
} from "./shared";
import { Choice } from "./findings-panel";
import {
  ACTION_STATUS_LABELS,
  ACTION_STATUS_ORDER,
  PRIORITY_LABELS,
  SUSTAINMENT_QUESTIONS,
  VALIDATION_RESULT_LABELS,
  type CapActionRow,
  type CapPriority,
  type CapResultRow,
  type CapRootGapRow,
  type CapValidationResult,
  type CapValidationRow,
} from "@/lib/capability-domain";
import {
  PRIORITY_FACTORS,
  formatValue,
  suggestedPriority,
  summarizeImprovement,
} from "@/lib/capability-scoring";
import { useCapDelete, useCapUpsert } from "@/lib/capability-api";
import {
  PartOutcomeFields,
  draftToNumbers,
  emptyBeforeAfterDraft,
} from "@/components/ironiq/part-outcome-fields";
import { PartOutcomeCardView } from "@/components/ironiq/part-outcome-card";
import {
  usePartOutcomeCards,
  useSavePartOutcomeCard,
  useShopMachines,
} from "@/lib/shop-floor-api";
import { machineLabel } from "@/lib/shop-floor";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { suggestRestorationActions } from "@/lib/capability-ai.functions";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";
import { Loader2, Plus, Sparkles, Trash2 } from "lucide-react";

export function RestorationPanel({
  assessmentId,
  organizationId,
  facilityId,
  actions,
  gaps,
  results,
  validations,
  aiContext,
}: {
  assessmentId: string;
  organizationId?: string | null;
  facilityId?: string | null;
  actions: CapActionRow[];
  gaps: CapRootGapRow[];
  results: CapResultRow[];
  validations: CapValidationRow[];
  aiContext: string;
}) {
  const upsert = useCapUpsert<Record<string, unknown>>(
    assessmentId,
    "cap_actions",
    {
      successMessage: "Restoration action saved",
    },
  );
  const remove = useCapDelete(
    assessmentId,
    "cap_actions",
    "Restoration action removed",
  );
  const [busy, setBusy] = useState(false);

  async function runAi() {
    const gap = gaps[0];
    if (!gap) {
      toast.error("Add a root capability gap first.");
      return;
    }
    setBusy(true);
    try {
      const out = (await suggestRestorationActions({
        data: { gap: gap.root_gap, context: aiContext },
      })) as { actions: Record<string, string>[] };
      for (const a of out.actions ?? []) {
        upsert.mutate({
          assessment_id: assessmentId,
          root_gap_id: gap.id,
          capability_gap: gap.root_gap,
          recommended_action: a["recommended_action"],
          expected_outcome: a["expected_outcome"],
          metric_name: a["metric_name"],
          unit: a["unit"],
          required_resources: a["required_resources"],
          estimated_effort: a["estimated_effort"],
          dependencies: a["dependencies"],
          validation_method: a["validation_method"],
          ai_generated: true,
          approved: false,
          status: "identified",
        });
      }
      toast.success("AI drafted actions added for review");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "AI assistance unavailable");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel
      title="Restoration Actions"
      subtitle="Validated capability gaps converted into measurable restoration work."
      actions={
        <div className="flex gap-2">
          <Button variant="outline" onClick={runAi} disabled={busy}>
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}
            Draft actions
          </Button>
          <Button
            onClick={() =>
              upsert.mutate({
                assessment_id: assessmentId,
                recommended_action: "New restoration action",
              })
            }
          >
            <Plus className="size-4" /> Add action
          </Button>
        </div>
      }
    >
      {actions.length === 0 ? (
        <EmptyState message="No restoration actions yet." />
      ) : (
        <div className="grid gap-4">
          {actions.map((a) => (
            <ActionCard
              key={a.id}
              assessmentId={assessmentId}
              organizationId={organizationId}
              facilityId={facilityId}
              action={a}
              gaps={gaps}
              results={results.filter((r) => r.action_id === a.id)}
              validations={validations.filter((v) => v.action_id === a.id)}
              onSave={(values) =>
                upsert.mutate({
                  id: a.id,
                  assessment_id: assessmentId,
                  ...values,
                })
              }
              onDelete={() => remove.mutate(a.id)}
            />
          ))}
        </div>
      )}
    </Panel>
  );
}

function ActionCard({
  assessmentId,
  organizationId,
  facilityId,
  action,
  gaps,
  results,
  validations,
  onSave,
  onDelete,
}: {
  assessmentId: string;
  organizationId?: string | null;
  facilityId?: string | null;
  action: CapActionRow;
  gaps: CapRootGapRow[];
  results: CapResultRow[];
  validations: CapValidationRow[];
  onSave: (values: Record<string, unknown>) => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({
    capability_gap: action.capability_gap ?? "",
    recommended_action: action.recommended_action,
    expected_outcome: action.expected_outcome ?? "",
    metric_name: action.metric_name ?? "",
    baseline_value: action.baseline_value?.toString() ?? "",
    target_value: action.target_value?.toString() ?? "",
    unit: action.unit ?? "",
    responsible_party: action.responsible_party ?? "",
    target_date: action.target_date ?? "",
    status: action.status,
    required_resources: action.required_resources ?? "",
    estimated_effort: action.estimated_effort ?? "",
    dependencies: action.dependencies ?? "",
    validation_method: action.validation_method ?? "",
    priority: action.priority,
    priority_override_justification:
      action.priority_override_justification ?? "",
    root_gap_id: action.root_gap_id ?? "",
  });
  const [ratings, setRatings] = useState<Record<string, number | null>>(
    Object.fromEntries(
      PRIORITY_FACTORS.map((f) => [
        f.key,
        (action[f.key] as number | null) ?? null,
      ]),
    ),
  );
  const set = (k: keyof typeof v, val: unknown) =>
    setV((s) => ({ ...s, [k]: val }));

  const suggestion = suggestedPriority({
    ...action,
    ...ratings,
  } as Partial<CapActionRow>);
  const improvement = summarizeImprovement(
    {
      baseline_value: v.baseline_value === "" ? null : Number(v.baseline_value),
      target_value: v.target_value === "" ? null : Number(v.target_value),
    },
    results,
  );
  const overridden =
    suggestion.priority !== null && suggestion.priority !== v.priority;

  const addResult = useCapUpsert<Record<string, unknown>>(
    assessmentId,
    "cap_results",
    {
      successMessage: "Measurement recorded",
    },
  );
  const addValidation = useCapUpsert<Record<string, unknown>>(
    assessmentId,
    "cap_validations",
    {
      successMessage: "Sustainment validation recorded",
    },
  );

  return (
    <div className="rounded-md border border-border">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full flex-wrap items-center gap-2 p-4 text-left"
      >
        <span className="min-w-48 flex-1 text-sm font-medium text-foreground">
          {action.recommended_action}
        </span>
        {action.ai_generated ? <AiBadge label="AI draft" /> : null}
        <PriorityBadge value={action.priority} />
        <ActionStatusBadge value={action.status} />
      </button>

      {open ? (
        <div className="space-y-5 border-t border-border p-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="md:col-span-2">
              <FieldLabel>Recommended action</FieldLabel>
              <Textarea
                className="mt-1.5 min-h-16"
                value={v.recommended_action}
                onChange={(e) => set("recommended_action", e.target.value)}
              />
            </div>
            <div>
              <FieldLabel>Capability gap</FieldLabel>
              <Textarea
                className="mt-1.5 min-h-16"
                value={v.capability_gap}
                onChange={(e) => set("capability_gap", e.target.value)}
              />
            </div>
            <div>
              <FieldLabel>Expected outcome</FieldLabel>
              <Textarea
                className="mt-1.5 min-h-16"
                value={v.expected_outcome}
                onChange={(e) => set("expected_outcome", e.target.value)}
              />
            </div>
            <Choice
              label="Linked root capability gap"
              value={v.root_gap_id}
              onChange={(x) => set("root_gap_id", x)}
              options={gaps.map((g) => ({ value: g.id, label: g.root_gap }))}
            />
            <Choice
              label="Status"
              value={v.status}
              onChange={(x) => set("status", x)}
              options={ACTION_STATUS_ORDER.map((s) => ({
                value: s,
                label: ACTION_STATUS_LABELS[s],
              }))}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <FieldLabel>Performance metric</FieldLabel>
              <Input
                className="mt-1.5"
                value={v.metric_name}
                onChange={(e) => set("metric_name", e.target.value)}
              />
            </div>
            <div>
              <FieldLabel>Baseline</FieldLabel>
              <Input
                className="mt-1.5"
                inputMode="decimal"
                value={v.baseline_value}
                onChange={(e) => set("baseline_value", e.target.value)}
              />
            </div>
            <div>
              <FieldLabel>Target</FieldLabel>
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
            <div>
              <FieldLabel>Responsible party</FieldLabel>
              <Input
                className="mt-1.5"
                value={v.responsible_party}
                onChange={(e) => set("responsible_party", e.target.value)}
              />
            </div>
            <div>
              <FieldLabel>Target date</FieldLabel>
              <Input
                type="date"
                className="mt-1.5"
                value={v.target_date}
                onChange={(e) => set("target_date", e.target.value)}
              />
            </div>
            <div>
              <FieldLabel>Estimated effort</FieldLabel>
              <Input
                className="mt-1.5"
                value={v.estimated_effort}
                onChange={(e) => set("estimated_effort", e.target.value)}
              />
            </div>
            <div>
              <FieldLabel>Required resources</FieldLabel>
              <Input
                className="mt-1.5"
                value={v.required_resources}
                onChange={(e) => set("required_resources", e.target.value)}
              />
            </div>
            <div>
              <FieldLabel>Dependencies</FieldLabel>
              <Input
                className="mt-1.5"
                value={v.dependencies}
                onChange={(e) => set("dependencies", e.target.value)}
              />
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <FieldLabel>Validation method</FieldLabel>
              <Input
                className="mt-1.5"
                value={v.validation_method}
                onChange={(e) => set("validation_method", e.target.value)}
              />
            </div>
          </div>

          {/* Prioritization */}
          <div className="rounded-md border border-dashed border-border p-3">
            <FieldLabel>
              Prioritization — assessor rates each factor 1–5
            </FieldLabel>
            <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {PRIORITY_FACTORS.map((f) => (
                <div
                  key={String(f.key)}
                  className="flex items-center justify-between gap-2 text-sm"
                >
                  <span className="text-muted-foreground">{f.label}</span>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() =>
                          setRatings((r) => ({
                            ...r,
                            [f.key]: r[f.key as string] === n ? null : n,
                          }))
                        }
                        className={
                          ratings[f.key as string] === n
                            ? "size-6 rounded-sm border border-primary bg-primary text-xs font-semibold text-primary-foreground"
                            : "size-6 rounded-sm border border-border text-xs text-muted-foreground hover:border-primary/60"
                        }
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
              <span className="text-muted-foreground">
                Suggested:{" "}
                {suggestion.priority
                  ? PRIORITY_LABELS[suggestion.priority]
                  : "—"}
                {suggestion.score !== null ? ` (${suggestion.score})` : ""}
              </span>
              <Choice
                label=""
                value={v.priority}
                onChange={(x) => set("priority", x as CapPriority)}
                options={(Object.keys(PRIORITY_LABELS) as CapPriority[]).map(
                  (p) => ({ value: p, label: PRIORITY_LABELS[p] }),
                )}
              />
            </div>
            {overridden ? (
              <div className="mt-2">
                <FieldLabel>Override justification (required)</FieldLabel>
                <Textarea
                  className="mt-1.5 min-h-14"
                  value={v.priority_override_justification}
                  onChange={(e) =>
                    set("priority_override_justification", e.target.value)
                  }
                />
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={() => {
                if (overridden && !v.priority_override_justification.trim()) {
                  toast.error(
                    "Justification is required when overriding the suggested priority.",
                  );
                  return;
                }
                onSave({
                  ...v,
                  ...ratings,
                  root_gap_id: v.root_gap_id || null,
                  target_date: v.target_date || null,
                  baseline_value:
                    v.baseline_value === "" ? null : Number(v.baseline_value),
                  target_value:
                    v.target_value === "" ? null : Number(v.target_value),
                  priority_score: suggestion.score,
                });
              }}
            >
              Save action
            </Button>
            <Button
              size="sm"
              variant={action.approved ? "outline" : "default"}
              onClick={() => onSave({ approved: !action.approved })}
            >
              {action.approved ? "Revoke approval" : "Approve action"}
            </Button>
            <Button size="sm" variant="ghost" onClick={onDelete}>
              <Trash2 className="size-4" /> Delete
            </Button>
          </div>

          <MeasuredImprovement
            action={action}
            organizationId={organizationId}
            facilityId={facilityId}
            improvement={improvement}
            results={results}
            onAdd={(values) =>
              addResult.mutate({ action_id: action.id, ...values })
            }
          />

          <SustainmentValidation
            validations={validations}
            onAdd={(values) =>
              addValidation.mutate({ action_id: action.id, ...values })
            }
          />
        </div>
      ) : null}
    </div>
  );
}

function MeasuredImprovement({
  action,
  organizationId,
  facilityId,
  improvement,
  results,
  onAdd,
}: {
  action: CapActionRow;
  organizationId?: string | null;
  facilityId?: string | null;
  improvement: ReturnType<typeof summarizeImprovement>;
  results: CapResultRow[];
  onAdd: (values: Record<string, unknown>) => void;
}) {
  const cards = usePartOutcomeCards(organizationId, facilityId).data ?? [];
  const machines = useShopMachines(organizationId, facilityId).data ?? [];
  const saveCard = useSavePartOutcomeCard(organizationId, facilityId);
  const existing =
    cards.find((c) => c.capability_action_id === action.id) ?? null;
  const [machineId, setMachineId] = useState(existing?.machine_id ?? "");
  const [draft, setDraft] = useState(
    emptyBeforeAfterDraft({
      partNumber: existing?.part_number ?? "",
      whatChanged: existing?.what_changed ?? action.recommended_action,
      cycleTimeSecBefore: existing
        ? String(existing.cycle_time_sec_before)
        : "",
      cycleTimeSecAfter: existing ? String(existing.cycle_time_sec_after) : "",
      setupMinBefore: existing ? String(existing.setup_min_before) : "",
      setupMinAfter: existing ? String(existing.setup_min_after) : "",
      hoursOnPartBefore: existing ? String(existing.hours_on_part_before) : "",
      hoursOnPartAfter: existing ? String(existing.hours_on_part_after) : "",
      partsPerShiftBefore:
        existing?.parts_per_shift_before != null
          ? String(existing.parts_per_shift_before)
          : "",
      partsPerShiftAfter:
        existing?.parts_per_shift_after != null
          ? String(existing.parts_per_shift_after)
          : "",
      downtimeMinBefore:
        existing?.downtime_min_before != null
          ? String(existing.downtime_min_before)
          : "",
      downtimeMinAfter:
        existing?.downtime_min_after != null
          ? String(existing.downtime_min_after)
          : "",
      beforeAt: existing?.before_at?.slice(0, 10) ?? "",
      afterAt: existing?.after_at?.slice(0, 10) ?? "",
    }),
  );

  return (
    <div className="rounded-md border border-dashed border-border p-3">
      <FieldLabel>Measured result</FieldLabel>
      <p className="mt-1 text-xs text-muted-foreground">
        Same structured fields as the CNC before/after card — not a free-text
        note.
      </p>
      {existing ? (
        <div className="mt-3">
          <PartOutcomeCardView card={existing} />
        </div>
      ) : null}
      <div className="mt-3 space-y-3">
        <div className="space-y-1.5">
          <FieldLabel>Machine</FieldLabel>
          <Select
            value={machineId || undefined}
            onValueChange={setMachineId}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a machine" />
            </SelectTrigger>
            <SelectContent>
              {machines.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {machineLabel(m)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <PartOutcomeFields draft={draft} onChange={setDraft} />
        <Button
          variant="outline"
          disabled={saveCard.isPending}
          onClick={() => {
            try {
              const numbers = draftToNumbers(draft);
              if (!draft.partNumber.trim() || !draft.whatChanged.trim()) {
                throw new Error("Part number and what changed are required.");
              }
              saveCard.mutate({
                id: existing?.id,
                partNumber: draft.partNumber,
                machineId: machineId || null,
                capabilityActionId: action.id,
                whatChanged: draft.whatChanged,
                cycleTimeSecBefore: numbers.cycle_time_sec_before,
                cycleTimeSecAfter: numbers.cycle_time_sec_after,
                setupMinBefore: numbers.setup_min_before,
                setupMinAfter: numbers.setup_min_after,
                hoursOnPartBefore: numbers.hours_on_part_before,
                hoursOnPartAfter: numbers.hours_on_part_after,
                partsPerShiftBefore: numbers.parts_per_shift_before,
                partsPerShiftAfter: numbers.parts_per_shift_after,
                downtimeMinBefore: numbers.downtime_min_before,
                downtimeMinAfter: numbers.downtime_min_after,
                beforeAt: draft.beforeAt || undefined,
                afterAt: draft.afterAt || undefined,
              });
              onAdd({
                actual_value: numbers.cycle_time_sec_after,
                notes: `cycle ${numbers.cycle_time_sec_before}→${numbers.cycle_time_sec_after}s; setup ${numbers.setup_min_before}→${numbers.setup_min_after}min; hours ${numbers.hours_on_part_before}→${numbers.hours_on_part_after}`,
              });
            } catch (error) {
              toast.error(
                error instanceof Error
                  ? error.message
                  : "Enter the required before/after numbers",
              );
            }
          }}
        >
          <Plus className="size-4" /> Save measured result
        </Button>
      </div>
      {results.length > 0 ? (
        <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
          {[...results]
            .sort(
              (a, b) =>
                new Date(b.measured_on).getTime() -
                new Date(a.measured_on).getTime(),
            )
            .map((r) => (
              <li key={r.id}>
                {formatDate(r.measured_on)}:{" "}
                {formatValue(r.actual_value, action.unit)}{" "}
                {r.notes ? `— ${r.notes}` : ""}
              </li>
            ))}
        </ul>
      ) : null}
      <p className="mt-2 text-xs text-muted-foreground">
        Target vs actual (legacy single metric):{" "}
        {formatValue(improvement.baseline, action.unit)} →{" "}
        {formatValue(improvement.target, action.unit)} →{" "}
        {formatValue(improvement.actual, action.unit)}
      </p>
    </div>
  );
}

function SustainmentValidation({
  validations,
  onAdd,
}: {
  validations: CapValidationRow[];
  onAdd: (values: Record<string, unknown>) => void;
}) {
  const [interval, setInterval] = useState("30");
  const [answers, setAnswers] = useState<Record<string, boolean>>({});
  const [result, setResult] =
    useState<CapValidationResult>("partially_restored");
  const [notes, setNotes] = useState("");

  return (
    <div className="rounded-md border border-dashed border-border p-3">
      <FieldLabel>
        Sustainment validation — a completed action is not a restored capability
      </FieldLabel>
      <ul className="mt-2 space-y-1 text-sm">
        {validations.map((v) => (
          <li key={v.id} className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground">
              {v.interval_days}-day • {formatDate(v.validated_on)}
            </span>
            <ValidationBadge value={v.result} />
            {v.notes ? (
              <span className="text-xs text-muted-foreground">{v.notes}</span>
            ) : null}
          </li>
        ))}
        {validations.length === 0 ? (
          <li className="text-muted-foreground">No validation recorded.</li>
        ) : null}
      </ul>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {SUSTAINMENT_QUESTIONS.map((q) => (
          <label
            key={q.key}
            className="flex items-center gap-2 text-sm text-muted-foreground"
          >
            <input
              type="checkbox"
              checked={answers[q.key] ?? false}
              onChange={(e) =>
                setAnswers((a) => ({ ...a, [q.key]: e.target.checked }))
              }
            />
            {q.label}
          </label>
        ))}
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-[8rem_16rem_1fr_auto]">
        <Choice
          label=""
          value={interval}
          onChange={setInterval}
          options={[
            { value: "30", label: "30-day" },
            { value: "60", label: "60-day" },
            { value: "90", label: "90-day" },
          ]}
        />
        <Choice
          label=""
          value={result}
          onChange={(x) => setResult(x as CapValidationResult)}
          options={(
            Object.keys(VALIDATION_RESULT_LABELS) as CapValidationResult[]
          ).map((r) => ({
            value: r,
            label: VALIDATION_RESULT_LABELS[r],
          }))}
        />
        <Input
          placeholder="Validation notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        <Button
          variant="outline"
          onClick={() => {
            onAdd({
              interval_days: Number(interval),
              result,
              notes,
              ...answers,
            });
            setNotes("");
            setAnswers({});
          }}
        >
          <Plus className="size-4" /> Record
        </Button>
      </div>
    </div>
  );
}
