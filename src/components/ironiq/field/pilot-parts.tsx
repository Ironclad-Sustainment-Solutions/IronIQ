/**
 * Implementation backlog, pilot definition and ROI. ROI figures are derived
 * only from assumptions the assessor entered; missing inputs are reported
 * rather than filled in.
 */

import { useState } from "react";
import { Plus } from "lucide-react";
import { Panel, EmptyState } from "@/components/ironiq/layout-primitives";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AutoField, EntryCard } from "@/components/ironiq/field/review-parts";
import {
  InlineNote,
  NumberField,
  QuickSelect,
  ScorePad,
  StatTile,
} from "@/components/ironiq/field/ops-primitives";
import {
  COMPLEXITY_LEVELS,
  DATA_CLASSES,
  OPPORTUNITY_STATUSES,
  PILOT_SCORES,
  computeRoi,
  metricDelta,
  pilotScore,
  type BaselineMetricRow,
  type OpportunityRow,
  type PilotMetricRow,
  type PilotRow,
} from "@/lib/field-ops";
import { cn } from "@/lib/utils";

const money = (v: number | null) =>
  v === null
    ? "—"
    : v.toLocaleString(undefined, {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      });

export function BacklogTab({
  opportunities,
  locked,
  onAdd,
  onUpdate,
  onDelete,
}: {
  opportunities: OpportunityRow[];
  locked: boolean;
  onAdd: (values: Partial<OpportunityRow>) => void;
  onUpdate: (id: string, values: Partial<OpportunityRow>) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <Panel
      title="Implementation backlog"
      subtitle="Every opportunity identified during the assessment, with its current status"
      actions={
        <Button
          size="sm"
          disabled={locked}
          onClick={() =>
            onAdd({
              title: "New opportunity",
              workflow_status: "Identified",
              sort_order: opportunities.length,
            })
          }
        >
          <Plus className="size-4" aria-hidden /> Add opportunity
        </Button>
      }
    >
      {opportunities.length === 0 ? (
        <EmptyState message="No opportunities in the backlog yet." />
      ) : (
        <div className="grid gap-3">
          {opportunities.map((o) => (
            <EntryCard
              key={o.id}
              title={o.title || o.opportunity || "Untitled opportunity"}
              disabled={locked}
              onDelete={() => onDelete(o.id)}
            >
              <div className="flex flex-wrap gap-2">
                <Badge
                  variant="outline"
                  className="text-[10px] uppercase tracking-wider"
                >
                  {o.workflow_status ?? "Identified"}
                </Badge>
                {o.is_pilot_candidate ? (
                  <Badge className="text-[10px] uppercase tracking-wider">
                    Pilot candidate
                  </Badge>
                ) : null}
              </div>
              <AutoField
                label="Title"
                value={o.title ?? o.opportunity}
                disabled={locked}
                onCommit={(title) => onUpdate(o.id, { title })}
              />
              <AutoField
                label="Problem"
                value={o.problem}
                multiline
                disabled={locked}
                onCommit={(problem) => onUpdate(o.id, { problem })}
              />
              <AutoField
                label="Capability gap"
                value={o.capability_gap}
                multiline
                disabled={locked}
                onCommit={(capability_gap) =>
                  onUpdate(o.id, { capability_gap })
                }
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <AutoField
                  label="Affected machines"
                  value={o.affected_machines}
                  disabled={locked}
                  onCommit={(affected_machines) =>
                    onUpdate(o.id, { affected_machines })
                  }
                />
                <AutoField
                  label="Affected parts"
                  value={o.affected_parts}
                  disabled={locked}
                  onCommit={(affected_parts) =>
                    onUpdate(o.id, { affected_parts })
                  }
                />
              </div>
              <AutoField
                label="Expected impact"
                value={o.expected_impact}
                multiline
                disabled={locked}
                onCommit={(expected_impact) =>
                  onUpdate(o.id, { expected_impact })
                }
              />
              <AutoField
                label="Recommended action"
                value={o.recommended_action}
                multiline
                disabled={locked}
                onCommit={(recommended_action) =>
                  onUpdate(o.id, { recommended_action })
                }
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <QuickSelect
                  label="Complexity"
                  options={COMPLEXITY_LEVELS}
                  value={o.complexity}
                  disabled={locked}
                  columns={2}
                  onChange={(complexity) => onUpdate(o.id, { complexity })}
                />
                <AutoField
                  label="Phase"
                  value={o.phase}
                  disabled={locked}
                  placeholder="e.g. Phase 1 pilot, Phase 2 rollout"
                  onCommit={(phase) => onUpdate(o.id, { phase })}
                />
              </div>
              <QuickSelect
                label="Status"
                options={OPPORTUNITY_STATUSES}
                value={o.workflow_status}
                disabled={locked}
                columns={3}
                onChange={(workflow_status) =>
                  onUpdate(o.id, { workflow_status })
                }
              />
              <label className="flex min-h-11 items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  className="size-5"
                  checked={o.is_pilot_candidate}
                  disabled={locked}
                  onChange={(e) =>
                    onUpdate(o.id, { is_pilot_candidate: e.target.checked })
                  }
                />
                Pilot candidate
              </label>
            </EntryCard>
          ))}
        </div>
      )}
    </Panel>
  );
}

export function PilotTab({
  pilots,
  pilotMetrics,
  opportunities,
  baselineMetrics,
  locked,
  onAdd,
  onUpdate,
  onDelete,
  onAddMetric,
  onUpdateMetric,
  onDeleteMetric,
}: {
  pilots: PilotRow[];
  pilotMetrics: PilotMetricRow[];
  opportunities: OpportunityRow[];
  baselineMetrics: BaselineMetricRow[];
  locked: boolean;
  onAdd: (values: Partial<PilotRow>) => void;
  onUpdate: (id: string, values: Partial<PilotRow>) => void;
  onDelete: (id: string) => void;
  onAddMetric: (pilotId: string, values: Partial<PilotMetricRow>) => void;
  onUpdateMetric: (
    pilotId: string,
    id: string,
    values: Partial<PilotMetricRow>,
  ) => void;
  onDeleteMetric: (pilotId: string, id: string) => void;
}) {
  const [openId, setOpenId] = useState<string | null>(pilots[0]?.id ?? null);
  const candidates = opportunities.filter((o) => o.is_pilot_candidate);

  return (
    <div className="space-y-4">
      <Panel
        title="Pilot candidates"
        subtitle="Score each candidate 1–5. The score is a decision aid, not an automatic selection."
        actions={
          <Button
            size="sm"
            disabled={locked}
            onClick={() => onAdd({ title: "New pilot" })}
          >
            <Plus className="size-4" aria-hidden /> Add pilot
          </Button>
        }
      >
        {candidates.length ? (
          <div className="mb-3 grid gap-2">
            <p className="eyebrow">Flagged in the backlog</p>
            <div className="flex flex-wrap gap-2">
              {candidates.map((c) => (
                <Button
                  key={c.id}
                  size="sm"
                  variant="outline"
                  disabled={
                    locked || pilots.some((p) => p.opportunity_id === c.id)
                  }
                  onClick={() =>
                    onAdd({
                      title: c.title ?? c.opportunity ?? "Pilot",
                      opportunity_id: c.id,
                    })
                  }
                >
                  Create pilot from “{c.title ?? c.opportunity}”
                </Button>
              ))}
            </div>
          </div>
        ) : (
          <InlineNote>
            Flag opportunities as pilot candidates in the implementation
            backlog.
          </InlineNote>
        )}
      </Panel>

      {pilots.length === 0 ? (
        <EmptyState message="No pilots defined yet." />
      ) : (
        pilots.map((p) => {
          const score = pilotScore(p);
          const roi = computeRoi(p);
          const metrics = pilotMetrics.filter((m) => m.pilot_id === p.id);
          const open = openId === p.id;
          return (
            <Panel
              key={p.id}
              title={p.title || "Untitled pilot"}
              subtitle={`Decision-aid score ${score.total}/${score.max} · ${score.answered}/${score.of} scored`}
              actions={
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setOpenId(open ? null : p.id)}
                  >
                    {open ? "Collapse" : "Expand"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={locked}
                    onClick={() => onDelete(p.id)}
                  >
                    Delete
                  </Button>
                </div>
              }
            >
              <div className="grid gap-2 sm:grid-cols-4">
                <StatTile label="Score" value={`${score.total}/35`} />
                <StatTile label="Annual value" value={money(roi.annualValue)} />
                <StatTile
                  label="Payback"
                  value={
                    roi.paybackWeeks === null
                      ? "—"
                      : `${roi.paybackWeeks} weeks`
                  }
                />
                <StatTile
                  label="ROI"
                  value={roi.roiPercent === null ? "—" : `${roi.roiPercent}%`}
                />
              </div>

              {!open ? null : (
                <div className="mt-4 grid gap-4">
                  <AutoField
                    label="Pilot title"
                    value={p.title}
                    disabled={locked}
                    onCommit={(title) => onUpdate(p.id, { title })}
                  />

                  <div>
                    <p className="eyebrow mb-2">
                      Decision aid (1 = low, 5 = high)
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {PILOT_SCORES.map((s) => (
                        <ScorePad
                          key={s.key}
                          label={s.label}
                          value={p[s.key] as number | null}
                          disabled={locked}
                          onChange={(v) =>
                            onUpdate(p.id, { [s.key]: v } as Partial<PilotRow>)
                          }
                        />
                      ))}
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <AutoField
                      label="Scope — part"
                      value={p.scope_part}
                      disabled={locked}
                      onCommit={(scope_part) => onUpdate(p.id, { scope_part })}
                    />
                    <AutoField
                      label="Scope — machine"
                      value={p.scope_machine}
                      disabled={locked}
                      onCommit={(scope_machine) =>
                        onUpdate(p.id, { scope_machine })
                      }
                    />
                    <AutoField
                      label="Scope — fixture"
                      value={p.scope_fixture}
                      disabled={locked}
                      onCommit={(scope_fixture) =>
                        onUpdate(p.id, { scope_fixture })
                      }
                    />
                    <AutoField
                      label="Capability gap addressed"
                      value={p.scope_capability_gap}
                      disabled={locked}
                      onCommit={(scope_capability_gap) =>
                        onUpdate(p.id, { scope_capability_gap })
                      }
                    />
                  </div>
                  <AutoField
                    label="Targeted outcome"
                    value={p.scope_outcome}
                    multiline
                    disabled={locked}
                    onCommit={(scope_outcome) =>
                      onUpdate(p.id, { scope_outcome })
                    }
                  />
                  <AutoField
                    label="What this pilot does not include"
                    value={p.scope_exceptions}
                    multiline
                    disabled={locked}
                    onCommit={(scope_exceptions) =>
                      onUpdate(p.id, { scope_exceptions })
                    }
                  />

                  <div className="grid gap-3">
                    <AutoField
                      label="Current condition"
                      value={p.current_condition}
                      multiline
                      disabled={locked}
                      onCommit={(current_condition) =>
                        onUpdate(p.id, { current_condition })
                      }
                    />
                    <AutoField
                      label="Validated capability gap"
                      value={p.validated_gap}
                      multiline
                      disabled={locked}
                      onCommit={(validated_gap) =>
                        onUpdate(p.id, { validated_gap })
                      }
                    />
                    <AutoField
                      label="Proposed change"
                      value={p.proposed_change}
                      multiline
                      disabled={locked}
                      onCommit={(proposed_change) =>
                        onUpdate(p.id, { proposed_change })
                      }
                    />
                    <div className="grid gap-3 sm:grid-cols-2">
                      <AutoField
                        label="Metric affected"
                        value={p.affected_metric}
                        disabled={locked}
                        onCommit={(affected_metric) =>
                          onUpdate(p.id, { affected_metric })
                        }
                      />
                      <AutoField
                        label="How success is measured"
                        value={p.validation_method}
                        disabled={locked}
                        onCommit={(validation_method) =>
                          onUpdate(p.id, { validation_method })
                        }
                      />
                    </div>
                    <AutoField
                      label="Deliverables"
                      value={p.deliverables}
                      multiline
                      disabled={locked}
                      onCommit={(deliverables) =>
                        onUpdate(p.id, { deliverables })
                      }
                    />
                    <AutoField
                      label="Exclusions"
                      value={p.exclusions}
                      multiline
                      disabled={locked}
                      onCommit={(exclusions) => onUpdate(p.id, { exclusions })}
                    />
                    <div className="grid gap-3 sm:grid-cols-2">
                      <NumberField
                        label="Estimated price"
                        value={p.estimated_price}
                        suffix="USD"
                        disabled={locked}
                        onCommit={(estimated_price) =>
                          onUpdate(p.id, { estimated_price })
                        }
                      />
                      <QuickSelect
                        label="Approval status"
                        options={["Draft", "Proposed", "Approved", "Declined"]}
                        value={p.approval_status}
                        disabled={locked}
                        columns={2}
                        onChange={(approval_status) =>
                          onUpdate(p.id, { approval_status })
                        }
                      />
                    </div>
                    <QuickSelect
                      label="Implementation status"
                      options={[
                        "Not started",
                        "In progress",
                        "Complete",
                        "Validated",
                      ]}
                      value={p.implementation_status}
                      disabled={locked}
                      columns={2}
                      onChange={(implementation_status) =>
                        onUpdate(p.id, { implementation_status })
                      }
                    />
                    <AutoField
                      label="Implementation notes"
                      value={p.implementation_notes}
                      multiline
                      disabled={locked}
                      onCommit={(implementation_notes) =>
                        onUpdate(p.id, { implementation_notes })
                      }
                    />
                  </div>

                  <div>
                    <p className="eyebrow mb-2">
                      Financial assumptions (entered by the assessor)
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      <NumberField
                        label="Machine burden rate"
                        value={p.machine_burden_rate}
                        suffix="/hr"
                        disabled={locked}
                        onCommit={(machine_burden_rate) =>
                          onUpdate(p.id, { machine_burden_rate })
                        }
                      />
                      <NumberField
                        label="Labor rate"
                        value={p.labor_rate}
                        suffix="/hr"
                        disabled={locked}
                        onCommit={(labor_rate) =>
                          onUpdate(p.id, { labor_rate })
                        }
                      />
                      <NumberField
                        label="Production value per hour"
                        value={p.production_value_hour}
                        suffix="/hr"
                        disabled={locked}
                        onCommit={(production_value_hour) =>
                          onUpdate(p.id, { production_value_hour })
                        }
                      />
                      <NumberField
                        label="Scrap cost"
                        value={p.scrap_cost}
                        suffix="USD"
                        disabled={locked}
                        onCommit={(scrap_cost) =>
                          onUpdate(p.id, { scrap_cost })
                        }
                      />
                      <NumberField
                        label="Overtime cost"
                        value={p.overtime_cost}
                        suffix="USD"
                        disabled={locked}
                        onCommit={(overtime_cost) =>
                          onUpdate(p.id, { overtime_cost })
                        }
                      />
                      <NumberField
                        label="Other cost basis"
                        value={p.other_cost_basis}
                        suffix="USD"
                        disabled={locked}
                        onCommit={(other_cost_basis) =>
                          onUpdate(p.id, { other_cost_basis })
                        }
                      />
                      <NumberField
                        label="Hours recovered per week"
                        value={p.hours_recovered_week}
                        suffix="hrs"
                        disabled={locked}
                        onCommit={(hours_recovered_week) =>
                          onUpdate(p.id, { hours_recovered_week })
                        }
                      />
                      <NumberField
                        label="ISS implementation cost"
                        value={p.iss_implementation_cost}
                        suffix="USD"
                        disabled={locked}
                        onCommit={(iss_implementation_cost) =>
                          onUpdate(p.id, { iss_implementation_cost })
                        }
                      />
                      <QuickSelect
                        label="Financial data class"
                        options={DATA_CLASSES}
                        value={p.financial_class}
                        disabled={locked}
                        columns={2}
                        onChange={(financial_class) =>
                          onUpdate(p.id, { financial_class })
                        }
                      />
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-4">
                      <StatTile
                        label="Hours recovered / yr"
                        value={
                          roi.annualHours === null
                            ? "—"
                            : String(roi.annualHours)
                        }
                      />
                      <StatTile
                        label="Hourly basis"
                        value={money(roi.hourlyValue)}
                      />
                      <StatTile
                        label="Annual value"
                        value={money(roi.annualValue)}
                      />
                      <StatTile
                        label="Payback"
                        value={
                          roi.paybackWeeks === null
                            ? "—"
                            : `${roi.paybackWeeks} weeks`
                        }
                      />
                    </div>
                    {roi.missing.length ? (
                      <div className="mt-2">
                        <InlineNote>
                          Not calculated yet — still needed:{" "}
                          {roi.missing.join(", ")}.
                        </InlineNote>
                      </div>
                    ) : null}
                  </div>

                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <p className="eyebrow">Before and after measurement</p>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={locked}
                        onClick={() =>
                          onAddMetric(p.id, {
                            metric_name:
                              p.affected_metric || "Measured outcome",
                            sort_order: metrics.length,
                          })
                        }
                      >
                        <Plus className="size-4" aria-hidden /> Add measurement
                      </Button>
                    </div>
                    {baselineMetrics.length ? (
                      <div className="mb-2 flex flex-wrap gap-2">
                        {baselineMetrics.map((b) => (
                          <Button
                            key={b.id}
                            size="sm"
                            variant="ghost"
                            disabled={locked}
                            onClick={() =>
                              onAddMetric(p.id, {
                                metric_name: b.metric_name,
                                unit: b.unit,
                                before_value: b.value,
                                baseline_metric_id: b.id,
                                sort_order: metrics.length,
                              })
                            }
                          >
                            Use baseline: {b.metric_name}
                          </Button>
                        ))}
                      </div>
                    ) : null}
                    {metrics.length === 0 ? (
                      <InlineNote>No measurements recorded yet.</InlineNote>
                    ) : (
                      <div className="grid gap-3">
                        {metrics.map((m) => {
                          const delta = metricDelta(
                            m.before_value,
                            m.after_value,
                          );
                          return (
                            <EntryCard
                              key={m.id}
                              title={m.metric_name}
                              disabled={locked}
                              onDelete={() => onDeleteMetric(p.id, m.id)}
                            >
                              <div className="grid gap-3 sm:grid-cols-3">
                                <AutoField
                                  label="Metric"
                                  value={m.metric_name}
                                  disabled={locked}
                                  onCommit={(metric_name) =>
                                    onUpdateMetric(p.id, m.id, { metric_name })
                                  }
                                />
                                <NumberField
                                  label="Before"
                                  value={m.before_value}
                                  disabled={locked}
                                  onCommit={(before_value) =>
                                    onUpdateMetric(p.id, m.id, { before_value })
                                  }
                                />
                                <NumberField
                                  label="After"
                                  value={m.after_value}
                                  disabled={locked}
                                  onCommit={(after_value) =>
                                    onUpdateMetric(p.id, m.id, { after_value })
                                  }
                                />
                              </div>
                              <p
                                className={cn(
                                  "text-sm",
                                  delta.difference === null
                                    ? "text-muted-foreground"
                                    : "text-foreground",
                                )}
                              >
                                Change:{" "}
                                {delta.difference === null
                                  ? "not yet measured"
                                  : `${delta.difference} ${m.unit ?? ""}${delta.percent === null ? "" : ` (${delta.percent}%)`}`}
                              </p>
                            </EntryCard>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </Panel>
          );
        })
      )}
    </div>
  );
}
