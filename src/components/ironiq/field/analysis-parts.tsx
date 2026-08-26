/**
 * Cause analysis: the causal chain builder, expert-dependency capture and the
 * measured baseline. Nothing here concludes a root cause on the assessor's
 * behalf — confidence and validation status stay explicit.
 */

import { Plus } from "lucide-react";
import { Panel, EmptyState } from "@/components/ironiq/layout-primitives";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AutoField,
  EntryCard,
  TagPicker,
} from "@/components/ironiq/field/review-parts";
import {
  InlineNote,
  NumberField,
  QuickSelect,
  StatTile,
} from "@/components/ironiq/field/ops-primitives";
import {
  BASELINE_METRIC_PRESETS,
  CAPABILITY_DOMAINS,
  CAUSE_LEVELS,
  CONFIDENCE_LEVELS,
  DATA_CLASSES,
  VALIDATION_STATUSES,
  type BaselineMetricRow,
  type CauseNodeRow,
  type ProductionEventRow,
  type SmeDependencyRow,
} from "@/lib/field-ops";

const domainLabels = CAPABILITY_DOMAINS.map((d) => `${d.label} — ${d.verb}`);
const labelToCode = (label: string) =>
  CAPABILITY_DOMAINS.find((d) => `${d.label} — ${d.verb}` === label)?.code ??
  label;
const codeToLabel = (code: string) => {
  const d = CAPABILITY_DOMAINS.find((x) => x.code === code);
  return d ? `${d.label} — ${d.verb}` : code;
};

export function CausalChainTab({
  causes,
  events,
  locked,
  onAdd,
  onUpdate,
  onDelete,
}: {
  causes: CauseNodeRow[];
  events: ProductionEventRow[];
  locked: boolean;
  onAdd: (values: Partial<CauseNodeRow>) => void;
  onUpdate: (id: string, values: Partial<CauseNodeRow>) => void;
  onDelete: (id: string) => void;
}) {
  const chains = [...new Set(causes.map((c) => c.chain_key))];

  return (
    <div className="space-y-4">
      <Panel
        title="Causal chain builder"
        subtitle="Observed condition → effect → immediate cause → contributing cause → underlying capability gap"
        actions={
          <Button
            size="sm"
            disabled={locked}
            onClick={() =>
              onAdd({
                chain_key: `chain-${chains.length + 1}`,
                level: "observed_condition",
                sort_order: causes.length,
              })
            }
          >
            <Plus className="size-4" aria-hidden /> New chain
          </Button>
        }
      >
        <InlineNote>
          Mark a step Validated only when evidence supports it. Suspected steps
          stay suspected in the report.
        </InlineNote>
      </Panel>

      {chains.length === 0 ? (
        <EmptyState message="No causal chains yet. Start one from a delay or event you observed." />
      ) : (
        chains.map((chainKey) => {
          const nodes = causes.filter((c) => c.chain_key === chainKey);
          const linkedEvent = events.find((e) => e.id === nodes[0]?.event_id);
          return (
            <Panel
              key={chainKey}
              title={chainKey.replace("chain-", "Chain ")}
              subtitle={
                linkedEvent
                  ? `${linkedEvent.event_type} · ${[linkedEvent.machine, linkedEvent.part].filter(Boolean).join(" · ")}`
                  : "Not linked to an event"
              }
            >
              <div className="grid gap-3">
                {CAUSE_LEVELS.map((level) => {
                  const node = nodes.find((n) => n.level === level.key);
                  if (!node) {
                    return (
                      <Button
                        key={level.key}
                        variant="outline"
                        className="min-h-12 justify-start"
                        disabled={locked}
                        onClick={() =>
                          onAdd({
                            chain_key: chainKey,
                            level: level.key,
                            event_id: nodes[0]?.event_id ?? null,
                            sort_order: causes.length,
                          })
                        }
                      >
                        <Plus className="size-4" aria-hidden /> Add{" "}
                        {level.label.toLowerCase()}
                      </Button>
                    );
                  }
                  return (
                    <EntryCard
                      key={level.key}
                      title={level.label}
                      disabled={locked}
                      onDelete={() => onDelete(node.id)}
                    >
                      <AutoField
                        label="Description"
                        value={node.description}
                        multiline
                        disabled={locked}
                        onCommit={(description) =>
                          onUpdate(node.id, { description })
                        }
                      />
                      <div className="grid gap-3 sm:grid-cols-2">
                        <QuickSelect
                          label="Confidence"
                          options={CONFIDENCE_LEVELS}
                          value={node.confidence}
                          disabled={locked}
                          columns={3}
                          onChange={(confidence) =>
                            onUpdate(node.id, { confidence })
                          }
                        />
                        <QuickSelect
                          label="Validation status"
                          options={VALIDATION_STATUSES}
                          value={node.validation_status}
                          disabled={locked}
                          columns={2}
                          onChange={(validation_status) =>
                            onUpdate(node.id, { validation_status })
                          }
                        />
                      </div>
                      {level.key === "capability_gap" ? (
                        <>
                          <TagPicker
                            label="Capability domains"
                            options={domainLabels}
                            selected={(node.domain_codes ?? []).map(
                              codeToLabel,
                            )}
                            disabled={locked}
                            onChange={(next) =>
                              onUpdate(node.id, {
                                domain_codes: next.map(labelToCode),
                              })
                            }
                          />
                          <label className="flex min-h-11 items-center gap-2 text-sm text-foreground">
                            <input
                              type="checkbox"
                              className="size-5"
                              checked={node.is_dominant}
                              disabled={locked}
                              onChange={(e) =>
                                onUpdate(node.id, {
                                  is_dominant: e.target.checked,
                                })
                              }
                            />
                            Dominant capability gap for this assessment
                          </label>
                        </>
                      ) : null}
                    </EntryCard>
                  );
                })}
              </div>
            </Panel>
          );
        })
      )}
    </div>
  );
}

export function SmeTab({
  smes,
  locked,
  onAdd,
  onUpdate,
  onDelete,
}: {
  smes: SmeDependencyRow[];
  locked: boolean;
  onAdd: (values: Partial<SmeDependencyRow>) => void;
  onUpdate: (id: string, values: Partial<SmeDependencyRow>) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <Panel
      title="Expert dependency"
      subtitle="Capture what one person knows that the process does not"
      actions={
        <Button size="sm" disabled={locked} onClick={() => onAdd({})}>
          <Plus className="size-4" aria-hidden /> Add expert
        </Button>
      }
    >
      {smes.length === 0 ? (
        <EmptyState message="No expert dependency captured yet." />
      ) : (
        <div className="grid gap-4">
          {smes.map((s) => {
            const rows = s.method_comparison ?? [];
            const setRows = (next: typeof rows) =>
              onUpdate(s.id, { method_comparison: next });
            return (
              <EntryCard
                key={s.id}
                title={s.sme_name || "Unnamed expert"}
                disabled={locked}
                onDelete={() => onDelete(s.id)}
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <AutoField
                    label="Name"
                    value={s.sme_name}
                    disabled={locked}
                    onCommit={(sme_name) => onUpdate(s.id, { sme_name })}
                  />
                  <AutoField
                    label="Scope (machines, parts, processes)"
                    value={s.scope}
                    disabled={locked}
                    onCommit={(scope) => onUpdate(s.id, { scope })}
                  />
                </div>
                <AutoField
                  label="What does this person do differently?"
                  value={s.does_differently}
                  multiline
                  disabled={locked}
                  onCommit={(does_differently) =>
                    onUpdate(s.id, { does_differently })
                  }
                />
                <AutoField
                  label="What decisions do they make?"
                  value={s.decisions_made}
                  multiline
                  disabled={locked}
                  onCommit={(decisions_made) =>
                    onUpdate(s.id, { decisions_made })
                  }
                />
                <AutoField
                  label="What knowledge is not documented?"
                  value={s.undocumented_knowledge}
                  multiline
                  disabled={locked}
                  onCommit={(undocumented_knowledge) =>
                    onUpdate(s.id, { undocumented_knowledge })
                  }
                />
                <AutoField
                  label="What adjustments are commonly required?"
                  value={s.common_adjustments}
                  multiline
                  disabled={locked}
                  onCommit={(common_adjustments) =>
                    onUpdate(s.id, { common_adjustments })
                  }
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  <AutoField
                    label="How often is assistance needed?"
                    value={s.assistance_frequency}
                    disabled={locked}
                    onCommit={(assistance_frequency) =>
                      onUpdate(s.id, { assistance_frequency })
                    }
                  />
                  <AutoField
                    label="Impact when they are unavailable"
                    value={s.impact_when_absent}
                    disabled={locked}
                    onCommit={(impact_when_absent) =>
                      onUpdate(s.id, { impact_when_absent })
                    }
                  />
                </div>

                <div className="mt-2 grid gap-2">
                  <div className="flex items-center justify-between">
                    <p className="eyebrow">
                      Best-known method vs typical method
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={locked}
                      onClick={() =>
                        setRows([
                          ...rows,
                          { aspect: "", best: "", typical: "" },
                        ])
                      }
                    >
                      <Plus className="size-4" aria-hidden /> Add row
                    </Button>
                  </div>
                  {rows.length === 0 ? (
                    <InlineNote>No comparison rows yet.</InlineNote>
                  ) : (
                    rows.map((r, i) => (
                      <div
                        key={i}
                        className="grid gap-2 rounded-sm border border-border p-3 sm:grid-cols-3"
                      >
                        <AutoField
                          label="Aspect"
                          value={r.aspect}
                          disabled={locked}
                          onCommit={(aspect) =>
                            setRows(
                              rows.map((x, xi) =>
                                xi === i ? { ...x, aspect } : x,
                              ),
                            )
                          }
                        />
                        <AutoField
                          label="Best-known method"
                          value={r.best}
                          disabled={locked}
                          onCommit={(best) =>
                            setRows(
                              rows.map((x, xi) =>
                                xi === i ? { ...x, best } : x,
                              ),
                            )
                          }
                        />
                        <AutoField
                          label="Typical method"
                          value={r.typical}
                          disabled={locked}
                          onCommit={(typical) =>
                            setRows(
                              rows.map((x, xi) =>
                                xi === i ? { ...x, typical } : x,
                              ),
                            )
                          }
                        />
                        <div className="sm:col-span-3">
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={locked}
                            onClick={() =>
                              setRows(rows.filter((_, xi) => xi !== i))
                            }
                          >
                            Remove row
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </EntryCard>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

export function BaselineMetricsTab({
  metrics,
  locked,
  onAdd,
  onUpdate,
  onDelete,
}: {
  metrics: BaselineMetricRow[];
  locked: boolean;
  onAdd: (values: Partial<BaselineMetricRow>) => void;
  onUpdate: (id: string, values: Partial<BaselineMetricRow>) => void;
  onDelete: (id: string) => void;
}) {
  const validated = metrics.filter(
    (m) => m.data_class === "Validated" || m.data_class === "Observed",
  );
  return (
    <div className="space-y-4">
      <Panel
        title="Baseline coverage"
        subtitle="Every figure is labelled by how it was obtained"
      >
        <div className="grid gap-2 sm:grid-cols-3">
          <StatTile label="Metrics captured" value={String(metrics.length)} />
          <StatTile
            label="Observed or validated"
            value={`${validated.length}/${metrics.length || 0}`}
            hint="Everything else is estimated or client reported"
          />
          <StatTile
            label="High confidence"
            value={String(
              metrics.filter((m) => m.confidence === "High").length,
            )}
          />
        </div>
      </Panel>

      <Panel
        title="Add a baseline metric"
        subtitle="Start from a standard metric or add your own"
      >
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {BASELINE_METRIC_PRESETS.map((p) => (
            <Button
              key={p.code}
              variant="outline"
              className="min-h-12 justify-start text-left"
              disabled={locked || metrics.some((m) => m.metric_code === p.code)}
              onClick={() =>
                onAdd({
                  metric_code: p.code,
                  metric_name: p.name,
                  unit: p.unit,
                  sort_order: metrics.length,
                })
              }
            >
              {p.name}
            </Button>
          ))}
          <Button
            variant="secondary"
            className="min-h-12"
            disabled={locked}
            onClick={() =>
              onAdd({
                metric_name: "Custom metric",
                sort_order: metrics.length,
              })
            }
          >
            <Plus className="size-4" aria-hidden /> Custom metric
          </Button>
        </div>
      </Panel>

      {metrics.length === 0 ? (
        <EmptyState message="No baseline metrics captured yet." />
      ) : (
        <Panel title="Measured baseline">
          <div className="grid gap-3">
            {metrics.map((m) => (
              <EntryCard
                key={m.id}
                title={m.metric_name}
                disabled={locked}
                onDelete={() => onDelete(m.id)}
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <AutoField
                    label="Metric"
                    value={m.metric_name}
                    disabled={locked}
                    onCommit={(metric_name) => onUpdate(m.id, { metric_name })}
                  />
                  <NumberField
                    label="Value"
                    value={m.value}
                    suffix={m.unit ?? undefined}
                    disabled={locked}
                    onCommit={(value) => onUpdate(m.id, { value })}
                  />
                  <AutoField
                    label="Unit"
                    value={m.unit}
                    disabled={locked}
                    onCommit={(unit) => onUpdate(m.id, { unit })}
                  />
                  <AutoField
                    label="Measurement period"
                    value={m.measurement_period}
                    disabled={locked}
                    placeholder="e.g. 3 observed changeovers, week of 4 Aug"
                    onCommit={(measurement_period) =>
                      onUpdate(m.id, { measurement_period })
                    }
                  />
                  <AutoField
                    label="Source"
                    value={m.source}
                    disabled={locked}
                    onCommit={(source) => onUpdate(m.id, { source })}
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <QuickSelect
                    label="Data class"
                    options={DATA_CLASSES}
                    value={m.data_class}
                    disabled={locked}
                    columns={3}
                    onChange={(data_class) => onUpdate(m.id, { data_class })}
                  />
                  <QuickSelect
                    label="Confidence"
                    options={CONFIDENCE_LEVELS}
                    value={m.confidence}
                    disabled={locked}
                    columns={3}
                    onChange={(confidence) => onUpdate(m.id, { confidence })}
                  />
                </div>
                <AutoField
                  label="Evidence note"
                  value={m.evidence_note}
                  multiline
                  disabled={locked}
                  onCommit={(evidence_note) =>
                    onUpdate(m.id, { evidence_note })
                  }
                />
                <Badge
                  variant="outline"
                  className="w-fit text-[10px] uppercase tracking-wider"
                >
                  {m.data_class}
                </Badge>
              </EntryCard>
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}
