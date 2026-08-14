import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  Plus,
  Printer,
  Sparkles,
  Trash2,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { Panel, EmptyState } from "@/components/ironiq/layout-primitives";
import { Button } from "@/components/ui/button";
import { AutoField, EntryCard, TagPicker } from "@/components/ironiq/field/review-parts";
import {
  Chip,
  EvidenceStrip,
  ObservationCard,
  ObservationDialog,
  QuickCaptureDialog,
  severityToken,
  type ObservationDraft,
} from "@/components/ironiq/field/capture-parts";
import {
  useFieldAssessment,
  useUpdateFieldAssessment,
} from "@/lib/field-assessment-api";
import {
  useConvertToFullAssessment,
  useDeleteEvidence,
  useFieldCapture,
  useGapMutations,
  useObservationMutations,
  useQuickCaptures,
  useUploadEvidence,
} from "@/lib/field-capture-api";
import {
  ASSESSMENT_STATUSES,
  ASSESSOR_CONFIDENCE,
  BAND_BG,
  BAND_LABEL,
  BAND_TEXT,
  DEFAULT_CONCLUSION,
  EVIDENCE_CLASSES,
  FIELD_DOMAINS,
  GAP_FREQUENCY,
  GAP_SEVERITY,
  GREDE_FOCUS_AREAS,
  IMPACT_LEVELS,
  IRONCLAD_ACTIONS,
  IRONCLAD_FIT,
  PRIORITY_CLASSES,
  PRIORITY_CLASS_HELP,
  PRIORITY_CODES,
  PROBLEM_IMPACT_OPTIONS,
  PRODUCTION_IMPACT_OPTIONS,
  ROOT_CAPABILITY_DOMAINS,
  URGENCY_LEVELS,
  domainByCode,
  fieldBaseline,
  suggestedPriority,
  type FieldCapabilityGap,
  type FieldCaptureObservationRow,
} from "@/lib/field-domains";
import { FIELD_SCALE } from "@/lib/field-form";
import { EventsTab } from "@/components/ironiq/field/event-parts";
import { BaselineMetricsTab, CausalChainTab, SmeTab } from "@/components/ironiq/field/analysis-parts";
import { BacklogTab, PilotTab } from "@/components/ironiq/field/pilot-parts";
import { FieldViewTab } from "@/components/ironiq/field/day-parts";
import {
  useBaselineMetricMutations,
  useCauseMutations,
  useDelayMutations,
  useEventMarks,
  useEventMutations,
  useEvidenceItemMutations,
  useFieldOps,
  useOpportunityMutations,
  usePilotMetricActions,
  usePilotMutations,
  useSmeMutations,
} from "@/lib/field-ops-api";
import {
  FieldOverviewTab,
  NextStepPanel,
  OpportunityTab,
  PreliminaryFindingsTab,
  ReviewMeetingTab,
  StatusBaselineTab,
} from "@/components/ironiq/field/followup-parts";
import {
  areaBaselines,
  areaByCode,
  areaTitle,
  STATUS_TEXT,

  buildClientSummary,
  recommendPath,
  type AreaBaseline,
  type FieldStatus,

} from "@/lib/field-followup";
import { draftFieldExecutiveSummary, suggestValidationQuestions } from "@/lib/field-ai.functions";
import { cn } from "@/lib/utils";


export const Route = createFileRoute("/_authenticated/field/$fieldId")({
  head: () => ({
    meta: [
      { title: "Field Capability Assessment — IronIQ" },
      {
        name: "description",
        content:
          "Run a rapid onsite Ironclad field capability assessment: capture observations, evidence and photos, build capability gaps and produce a preliminary field baseline.",
      },
      { property: "og:title", content: "Field Capability Assessment — IronIQ" },
      {
        property: "og:description",
        content: "Rapid onsite capability capture with a preliminary field baseline.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FieldCapture,
});

type Tab =
  | "intake"
  | "fieldview"
  | "events"
  | "causes"
  | "experts"
  | "metrics"
  | "backlog"
  | "pilot"
  | "overview"
  | "walk"
  | "captures"
  | "gaps"
  | "findings"
  | "priority"
  | "baseline"
  | "summary"
  | "review"
  | "opportunity"
  | "report";

const TABS: { id: Tab; label: string }[] = [
  { id: "intake", label: "Client problem" },
  { id: "fieldview", label: "Field view" },
  { id: "overview", label: "Field overview" },
  { id: "events", label: "Events & timing" },
  { id: "causes", label: "Cause analysis" },
  { id: "experts", label: "Expert dependency" },
  { id: "metrics", label: "Baseline metrics" },
  { id: "walk", label: "Field walk" },
  { id: "captures", label: "Quick captures" },
  { id: "gaps", label: "Capability gaps" },
  { id: "findings", label: "Preliminary findings" },
  { id: "priority", label: "Priority matrix" },
  { id: "baseline", label: "Field baseline" },
  { id: "summary", label: "Client summary" },
  { id: "review", label: "Findings review" },
  { id: "opportunity", label: "Opportunity (internal)" },
  { id: "backlog", label: "Implementation backlog" },
  { id: "pilot", label: "Pilot & ROI" },
  { id: "report", label: "Report" },
];


interface AssessmentExtras {
  facility_name: string | null;
  facility_location: string | null;
  assessment_date: string | null;
  client_contact: string | null;
  client_contact_title: string | null;
  assessment_status: string | null;
  problem_department: string | null;
  problem_machine: string | null;
  problem_cell: string | null;
  impact_notes: string | null;
  executive_summary: string | null;
  preliminary_conclusion: string | null;
  baseline_statuses: Record<string, string> | null;
  client_summary: string | null;
  rec_significant_constraints: boolean | null;
  rec_measurable_impact: boolean | null;
  rec_unvalidated: boolean | null;
  rec_deeper_helps: boolean | null;
  rec_in_scope: boolean | null;
  recommended_path: string | null;
  review_meeting_date: string | null;
  review_attendees: string | null;
  review_notes: string | null;
  meeting_new_info: string | null;
  meeting_new_gaps: string | null;
  meeting_data_promised: string | null;
  meeting_scope: string | null;
  meeting_projects: string | null;
  meeting_decision: string | null;
  meeting_next_action: string | null;
  meeting_owner: string | null;
  meeting_target_date: string | null;
  assessment_name: string | null;
  objective: string | null;
  primary_operational_question: string | null;
  assessment_lead: string | null;
  team_members: string | null;
  start_date: string | null;
  target_completion_date: string | null;
  est_impact_notes: string | null;
  est_lost_hours_week: number | null;
  known_machines: string | null;
  known_parts: string | null;
  known_smes: string | null;
  day_focus: string | null;
}


function FieldCapture() {
  const { fieldId } = Route.useParams();
  const navigate = useNavigate();
  const { data, isLoading } = useFieldAssessment(fieldId);
  const capture = useFieldCapture(fieldId);
  const update = useUpdateFieldAssessment(fieldId);
  const observations = useObservationMutations(fieldId);
  const quick = useQuickCaptures(fieldId);
  const gaps = useGapMutations(fieldId);
  const upload = useUploadEvidence(fieldId);
  const removeEvidence = useDeleteEvidence(fieldId);
  const convert = useConvertToFullAssessment(fieldId);
  const ops = useFieldOps(fieldId);
  const eventMut = useEventMutations(fieldId);
  const marksMut = useEventMarks(fieldId);
  const delayMut = useDelayMutations(fieldId);
  const causeMut = useCauseMutations(fieldId);
  const evidenceMut = useEvidenceItemMutations(fieldId);
  const smeMut = useSmeMutations(fieldId);
  const metricMut = useBaselineMetricMutations(fieldId);
  const pilotMut = usePilotMutations(fieldId);
  const backlogMut = useOpportunityMutations(fieldId);
  const pilotMetricMut = usePilotMetricActions(fieldId);

  const [tab, setTab] = useState<Tab>("intake");
  const [domainCode, setDomainCode] = useState(FIELD_DOMAINS[0]!.code);
  const [obsOpen, setObsOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [editing, setEditing] = useState<FieldCaptureObservationRow | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [questionBusyId, setQuestionBusyId] = useState<string | null>(null);
  const draftSummary = useServerFn(draftFieldExecutiveSummary);
  const draftQuestions = useServerFn(suggestValidationQuestions);

  const obsRows = capture.data?.observations ?? [];
  const gapRows = capture.data?.gaps ?? [];
  const attachments = capture.data?.attachments ?? [];
  const quickRows = capture.data?.quickCaptures ?? [];
  const baseline = useMemo(() => fieldBaseline(obsRows, gapRows), [obsRows, gapRows]);
  const overrides = (data?.assessment as Record<string, any> | undefined)?.['baseline_statuses'] ?? {};
  const areas = useMemo(
    () => areaBaselines(obsRows, gapRows, overrides as Record<string, string>),
    [obsRows, gapRows, overrides],
  );
  const topFindings = useMemo(
    () => gapRows.filter((g) => g.is_top_finding),
    [gapRows],
  );


  if (isLoading) return <EmptyState message="Loading field assessment…" />;
  if (!data?.assessment) return <EmptyState message="Field assessment not found." />;

  const a = data.assessment as typeof data.assessment & AssessmentExtras;
  const locked = a.assessment_status === "Delivered" || a.status === "submitted";
  const set = (values: Record<string, unknown>) => update.mutate(values);
  const opsData = ops.data ?? {
    events: [],
    marks: [],
    delays: [],
    causes: [],
    evidence: [],
    smes: [],
    metrics: [],
    pilots: [],
    pilotMetrics: [],
    opportunities: [],
  };

  const setAreaStatus = (areaCode: string, status: FieldStatus | null) => {
    const next = { ...(overrides as Record<string, string>) };
    if (status) next[areaCode] = status;
    else delete next[areaCode];
    set({ baseline_statuses: next });
  };

  const pathAnswers = {
    significantConstraints: a['rec_significant_constraints'] ?? null,
    measurableImpact: a['rec_measurable_impact'] ?? null,
    unvalidated: a['rec_unvalidated'] ?? null,
    deeperHelps: a['rec_deeper_helps'] ?? null,
    inScope: a['rec_in_scope'] ?? null,
  };
  const recommendation = recommendPath(pathAnswers);

  const runQuestions = async (gap: FieldCapabilityGap) => {
    setQuestionBusyId(gap.id);
    try {
      const out = await draftQuestions({
        data: {
          finding: [
            `Finding: ${gap.title ?? "—"}`,
            `Observed: ${gap.observed_condition ?? "—"}`,
            `Operational impact: ${gap.operational_impact_text ?? "—"}`,
            `Preliminary constraint: ${gap.preliminary_constraint ?? "—"}`,
            `Evidence classification: ${gap.evidence_class ?? "—"}`,
          ].join("\n"),
        },
      });
      gaps.update.mutate({
        id: gap.id,
        values: { validation_questions: out.questions, data_requirements: out.data_requirements },
      });
      toast.success("Draft validation questions ready for your review");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not draft questions");
    } finally {
      setQuestionBusyId(null);
    }
  };


  const saveObservation = (draft: ObservationDraft, opts: { addAnother: boolean; photo: File | null }) => {
    const values = {
      domain_code: draft.domain_code,
      category: draft.category,
      area: draft.area || null,
      machine: draft.machine || null,
      production_cell: draft.production_cell || null,
      process: draft.process || null,
      observed_condition: draft.observed_condition || null,
      objective_evidence: draft.objective_evidence || null,
      assessor_notes: draft.assessor_notes || null,
      context_source: draft.context_source || null,
      rating: draft.rating,
      not_observed: draft.not_observed,
      evidence_class: draft.evidence_class,
    };
    if (editing) {
      observations.update.mutate({ id: editing.id, values });
      setEditing(null);
      setObsOpen(false);
      return;
    }
    observations.add.mutate(values, {
      onSuccess: (id) => {
        if (opts.photo) {
          upload.mutate({
            file: opts.photo,
            observationId: id,
            area: values.area,
            machine: values.machine,
            domainCode: values.domain_code,
          });
        }
        if (!opts.addAnother) setObsOpen(false);
      },
    });
  };

  const runSummary = async () => {
    setAiBusy(true);
    try {
      const context = [
        `Client: ${a.client_name ?? "—"} · Facility: ${a.facility_name ?? a.area ?? "—"} ${a.facility_location ?? ""}`,
        `Client-stated problem: ${a.problem_statement ?? "—"}`,
        `Where/when: ${[a.problem_department, a.problem_machine, a.problem_cell, a.problem_timing].filter(Boolean).join(" · ")}`,
        `Stated impact: ${(a.impact_tags ?? []).join(", ")} ${a.impact_notes ?? ""}`,
        `Already attempted: ${a.attempted ?? "—"}`,
        `Desired outcome: ${a.improvement_if_resolved ?? "—"}`,
        "",
        "OBSERVATIONS:",
        ...obsRows.map(
          (o) =>
            `- [${domainByCode(o.domain_code)?.title}] ${o.category ?? ""} @ ${[o.area, o.machine].filter(Boolean).join("/")} — rating ${o.not_observed ? "N/O" : (o.rating ?? "unrated")} (${o.evidence_class}). ${o.observed_condition ?? ""} Evidence: ${o.objective_evidence ?? "none recorded"}`,
        ),
        "",
        "CAPABILITY GAPS:",
        ...gapRows.map(
          (g) =>
            `- ${g.title ?? "Gap"} [${g.severity ?? "unrated"} / ${g.priority_code ?? "unprioritized"}] ${g.observed_condition ?? ""} Missing capability: ${g.missing_capability ?? "—"} Expected result: ${g.expected_result ?? "—"}`,
        ),
        "",
        `Coverage: ${baseline.overallCoveragePct}% of observation categories across ${baseline.domainsObserved}/8 domains.`,
      ].join("\n");

      const out = await draftSummary({ data: { context: context.slice(0, 24000) } });
      set({
        executive_summary: [
          out.executive_summary,
          "",
          `What the client told us: ${out.what_client_told_us}`,
          `What Ironclad observed: ${out.what_ironclad_observed}`,
          `Most significant capability gaps: ${out.most_significant_gaps}`,
          `Connected production impact: ${out.connected_production_impact}`,
          `Where Ironclad could help: ${out.where_ironclad_could_help}`,
          "",
          "To validate in a full capability assessment:",
          ...out.validate_in_full_assessment.map((v) => `• ${v}`),
        ].join("\n"),
      });
      toast.success("Draft executive summary ready for your review");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not draft the summary");
    } finally {
      setAiBusy(false);
    }
  };

  return (
    <div className="space-y-4 pb-24">
      <div className="no-print grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
        <Button variant="ghost" size="icon" aria-label="Back to field assessments" asChild>
          <Link to="/field">
            <ArrowLeft className="size-4" aria-hidden />
          </Link>
        </Button>
        <div className="min-w-0">
          <p className="eyebrow">Ironclad Field Capability Assessment</p>
          <h1 className="truncate text-xl font-semibold uppercase tracking-wide text-foreground">
            {a.client_name || a.area || "Untitled assessment"}
          </h1>
          <p className="truncate text-xs text-muted-foreground">
            {[a.facility_name, a.facility_location].filter(Boolean).join(" · ") || a.area}
            {a.assessment_date ? ` · ${a.assessment_date}` : ""}
          </p>
        </div>
        {locked ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => set({ assessment_status: "In Progress", status: "in_progress" })}
          >
            Reopen assessment
          </Button>
        ) : (
          <Button size="sm" onClick={() => setQuickOpen(true)}>
            <Zap className="size-4" aria-hidden /> Quick capture
          </Button>
        )}
      </div>

      <BaselineStrip baseline={baseline} gapCount={gapRows.length} areas={areas} />


      <nav className="no-print flex gap-1 overflow-x-auto border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "shrink-0 border-b-2 px-3 py-2 text-xs font-semibold uppercase tracking-widest transition-colors",
              tab === t.id
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "intake" ? (
        <IntakeTab assessment={a} locked={locked} set={set} />
      ) : null}

      {tab === "overview" ? (
        <FieldOverviewTab
          baselines={areas}
          observations={obsRows}
          locked={locked}
          hasGap={(id) => gapRows.some((g) => g.observation_id === id)}
          onAddObservation={(areaCode) =>
            observations.add.mutate({
              domain_code: areaByCode(areaCode)?.domain_code ?? "production_operations",
              focus_area: areaCode,
              evidence_class: "Observed",
            } as never)
          }
          onUpdateObservation={(id, values) => observations.update.mutate({ id, values })}
          onDeleteObservation={(id) => observations.remove.mutate(id)}
          onPromote={(row) =>
            gaps.fromObservation.mutate({ observation: row, gapNumber: gapRows.length + 1 })
          }
        />
      ) : null}

      {tab === "findings" ? (
        <PreliminaryFindingsTab
          findings={topFindings}
          allGaps={gapRows}
          locked={locked}
          aiBusyId={questionBusyId}
          onSuggestQuestions={runQuestions}
          onAdd={() =>
            gaps.add.mutate({ gap_number: gapRows.length + 1, sort_order: gapRows.length + 1 })
          }
          onUpdate={(id, values) => gaps.update.mutate({ id, values })}
          onDelete={(id) => gaps.remove.mutate(id)}
        />
      ) : null}

      {tab === "summary" ? (
        <div className="space-y-4">
          <NextStepPanel
            answers={{
              rec_significant_constraints: a.rec_significant_constraints ?? null,
              rec_measurable_impact: a.rec_measurable_impact ?? null,
              rec_unvalidated: a.rec_unvalidated ?? null,
              rec_deeper_helps: a.rec_deeper_helps ?? null,
              rec_in_scope: a.rec_in_scope ?? null,
            }}
            recommendation={recommendation}
            chosen={a.recommended_path}
            locked={locked}
            onAnswer={(column, value) => set({ [column]: value })}
            onChoose={(recommended_path) => set({ recommended_path })}
          />
          <Panel
            title="Client field summary"
            subtitle="Two to four pages, plain language, no unverified claims"
            actions={
              <div className="no-print flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={locked}
                  onClick={() =>
                    set({
                      client_summary: buildClientSummary({
                        clientName: a.client_name,
                        facility: [a.facility_name, a.facility_location].filter(Boolean).join(", ") || a.area,
                        date: a.assessment_date,
                        assessors: a.assessors,
                        problem: a.problem_statement,
                        areas,
                        findings: topFindings,
                        unknowns: obsRows
                          .filter((o) => o.requires_validation || o.evidence_class === "Requires Validation")
                          .map(
                            (o) =>
                              `${areaByCode(o.focus_area)?.title ?? "General"}: ${o.observed_condition ?? "Requires validation"}`,
                          ),
                        recommendation: a.recommended_path ?? recommendation.path,
                        rationale: recommendation.rationale,
                      }),
                    })
                  }
                >
                  Generate summary
                </Button>
                <Button size="sm" variant="outline" onClick={() => window.print()}>
                  <Printer className="size-4" aria-hidden /> Print / PDF
                </Button>
              </div>
            }
          >
            <AutoField
              value={a.client_summary}
              multiline
              rows={24}
              disabled={locked}
              onCommit={(v) => set({ client_summary: v })}
            />
          </Panel>
        </div>
      ) : null}

      {tab === "review" ? (
        <ReviewMeetingTab
          assessment={a}
          findings={topFindings}
          locked={locked}
          set={set}
          onUpdateFinding={(id, values) => gaps.update.mutate({ id, values })}
        />
      ) : null}

      {tab === "fieldview" ? (
        <FieldViewTab
          setup={{
            assessment_name: a.assessment_name ?? null,
            objective: a.objective ?? null,
            primary_operational_question: a.primary_operational_question ?? null,
            assessment_lead: a.assessment_lead ?? null,
            team_members: a.team_members ?? null,
            start_date: a.start_date ?? null,
            target_completion_date: a.target_completion_date ?? null,
            est_impact_notes: a.est_impact_notes ?? null,
            est_lost_hours_week: a.est_lost_hours_week ?? null,
            known_machines: a.known_machines ?? null,
            known_parts: a.known_parts ?? null,
            known_smes: a.known_smes ?? null,
            day_focus: a.day_focus ?? null,
          }}
          locked={locked}
          set={(values) => set(values as Record<string, unknown>)}
          events={opsData.events}
          delays={opsData.delays}
          causes={opsData.causes}
          evidence={opsData.evidence}
          metrics={opsData.metrics}
          pilots={opsData.pilots}
        />
      ) : null}

      {tab === "events" ? (
        <EventsTab
          events={opsData.events}
          marks={opsData.marks}
          delays={opsData.delays}
          evidence={opsData.evidence}
          locked={locked}
          onAddEvent={(values) => eventMut.add.mutate(values)}
          onUpdateEvent={(id, values) => eventMut.update.mutate({ id, values })}
          onDeleteEvent={(id) => eventMut.remove.mutate(id)}
          onMark={(eventId, markCode, existing) =>
            marksMut.mark.mutate({ eventId, markCode, existing })
          }
          onClearMark={(id) => marksMut.clear.mutate(id)}
          onAddDelay={(values) => delayMut.add.mutate(values)}
          onUpdateDelay={(id, values) => delayMut.update.mutate({ id, values })}
          onDeleteDelay={(id) => delayMut.remove.mutate(id)}
          onAddEvidence={(values) => evidenceMut.add.mutate(values)}
          onUpdateEvidence={(id, values) => evidenceMut.update.mutate({ id, values })}
          onDeleteEvidence={(id) => evidenceMut.remove.mutate(id)}
        />
      ) : null}

      {tab === "causes" ? (
        <CausalChainTab
          causes={opsData.causes}
          events={opsData.events}
          locked={locked}
          onAdd={(values) => causeMut.add.mutate(values)}
          onUpdate={(id, values) => causeMut.update.mutate({ id, values })}
          onDelete={(id) => causeMut.remove.mutate(id)}
        />
      ) : null}

      {tab === "experts" ? (
        <SmeTab
          smes={opsData.smes}
          locked={locked}
          onAdd={(values) => smeMut.add.mutate(values)}
          onUpdate={(id, values) => smeMut.update.mutate({ id, values })}
          onDelete={(id) => smeMut.remove.mutate(id)}
        />
      ) : null}

      {tab === "metrics" ? (
        <BaselineMetricsTab
          metrics={opsData.metrics}
          locked={locked}
          onAdd={(values) => metricMut.add.mutate(values)}
          onUpdate={(id, values) => metricMut.update.mutate({ id, values })}
          onDelete={(id) => metricMut.remove.mutate(id)}
        />
      ) : null}

      {tab === "backlog" ? (
        <BacklogTab
          opportunities={opsData.opportunities}
          locked={locked}
          onAdd={(values) => backlogMut.add.mutate(values)}
          onUpdate={(id, values) => backlogMut.update.mutate({ id, values })}
          onDelete={(id) => backlogMut.remove.mutate(id)}
        />
      ) : null}

      {tab === "pilot" ? (
        <PilotTab
          pilots={opsData.pilots}
          pilotMetrics={opsData.pilotMetrics}
          opportunities={opsData.opportunities}
          baselineMetrics={opsData.metrics}
          locked={locked}
          onAdd={(values) => pilotMut.add.mutate(values)}
          onUpdate={(id, values) => pilotMut.update.mutate({ id, values })}
          onDelete={(id) => pilotMut.remove.mutate(id)}
          onAddMetric={(pilotId, values) => pilotMetricMut.add(pilotId, values)}
          onUpdateMetric={(_pilotId, id, values) => pilotMetricMut.update(id, values)}
          onDeleteMetric={(_pilotId, id) => pilotMetricMut.remove(id)}
        />
      ) : null}

      {tab === "opportunity" ? (
        <OpportunityTab
          findings={topFindings.length ? topFindings : gapRows}
          locked={locked}
          onUpdate={(id, values) => gaps.update.mutate({ id, values })}
        />
      ) : null}


      {tab === "walk" ? (
        <section className="space-y-4">
          <Panel
            title="Field walk"
            subtitle="Capture what you see. Nothing is required — coverage and confidence are reported honestly."
          >
            <div className="flex flex-wrap gap-1.5">
              {FIELD_DOMAINS.map((d) => {
                const b = baseline.domains.find((x) => x.domain.code === d.code)!;
                return (
                  <button
                    key={d.code}
                    type="button"
                    onClick={() => setDomainCode(d.code)}
                    className={cn(
                      "rounded-sm border px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide transition-colors",
                      domainCode === d.code
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {d.number}. {d.title}
                    <span className={cn("ml-2", BAND_TEXT[b.band])}>
                      {b.averageRating === null ? "—" : b.averageRating.toFixed(1)}
                    </span>
                  </button>
                );
              })}
            </div>
          </Panel>

          <DomainPanel
            code={domainCode}
            observations={obsRows}
            attachments={attachments}
            gaps={gapRows}
            locked={locked}
            onAdd={() => {
              setEditing(null);
              setObsOpen(true);
            }}
            onEdit={(row) => {
              setEditing(row);
              setObsOpen(true);
            }}
            onDelete={(id) => observations.remove.mutate(id)}
            onCreateGap={(row) =>
              gaps.fromObservation.mutate({ observation: row, gapNumber: gapRows.length + 1 })
            }
          />

          <Panel title="Rating scale" subtitle="Preliminary field ratings only">
            <ul className="grid gap-2 sm:grid-cols-2">
              {FIELD_SCALE.map((s) => (
                <li key={s.value} className="grid grid-cols-[auto_minmax(0,1fr)] gap-3">
                  <span className="metric text-lg font-semibold text-foreground">{s.value}</span>
                  <span className="min-w-0 text-xs text-muted-foreground">
                    <strong className="text-foreground">{s.label}</strong> — {s.description}
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
        </section>
      ) : null}

      {tab === "captures" ? (
        <Panel
          title="Quick captures"
          subtitle="30-second shop-floor notes. Convert them into structured observations when you get a moment."
          actions={
            <Button size="sm" disabled={locked} onClick={() => setQuickOpen(true)}>
              <Plus className="size-4" aria-hidden /> New capture
            </Button>
          }
        >
          {quickRows.length === 0 ? (
            <EmptyState message="No quick captures yet." />
          ) : (
            <div className="grid gap-3">
              {quickRows.map((c) => (
                <div key={c.id} className="rounded-sm border border-border p-3">
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                    <div className="min-w-0">
                      <p className="text-sm text-foreground">{c.note || c.potential_problem}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {[c.area, c.machine, domainByCode(c.domain_code)?.title].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Delete quick capture"
                      disabled={locked}
                      onClick={() => quick.remove.mutate(c.id)}
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </Button>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {attachments
                      .filter((at) => at.caption === `quick:${c.id}`)
                      .map((at) => (
                        <Chip key={at.id} label={at.file_name ?? "Photo"} />
                      ))}
                    {c.converted_observation_id ? (
                      <Chip label="Converted" className="text-success" />
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={locked || quick.convert.isPending}
                        onClick={() => quick.convert.mutate(c)}
                      >
                        Convert to observation
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      ) : null}

      {tab === "gaps" ? (
        <GapsTab
          gaps={gapRows}
          attachments={attachments}
          locked={locked}
          onAdd={() =>
            gaps.add.mutate({ gap_number: gapRows.length + 1, sort_order: gapRows.length + 1 })
          }
          onUpdate={(id, values) => gaps.update.mutate({ id, values })}
          onDelete={(id) => gaps.remove.mutate(id)}
          onUpload={(gapId, file) => upload.mutate({ file, gapId })}
          onRemoveEvidence={(row) => removeEvidence.mutate(row)}
          uploading={upload.isPending}
        />
      ) : null}

      {tab === "priority" ? (
        <PriorityTab
          gaps={gapRows}
          locked={locked}
          onUpdate={(id, values) => gaps.update.mutate({ id, values })}
        />
      ) : null}

      {tab === "baseline" ? (
        <div className="space-y-4">
          <StatusBaselineTab baselines={areas} locked={locked} onSetStatus={setAreaStatus} />
          <BaselineTab baseline={baseline} />
        </div>
      ) : null}


      {tab === "report" ? (
        <ReportTab
          assessment={a}
          locked={locked}
          set={set}
          areas={areas}
          recommendation={recommendation}

          gaps={gapRows}
          observations={obsRows}
          aiBusy={aiBusy}
          onDraft={runSummary}
          converting={convert.isPending}
          onConvert={() =>
            convert.mutate(
              {
                assessment: {
                  id: a.id,
                  organization_id: a.organization_id,
                  facility_id: a.facility_id,
                  client_name: a.client_name,
                  area: a.area,
                  assessors: a.assessors,
                  problem_statement: a.problem_statement,
                  problem_area: a.problem_area,
                  problem_department: a['problem_department'] ?? null,
                  problem_machine: a['problem_machine'] ?? null,
                  problem_cell: a['problem_cell'] ?? null,
                  problem_process: a.problem_process ?? null,
                  problem_timing: a.problem_timing,

                  attempted: a.attempted,
                  improvement_if_resolved: a.improvement_if_resolved,
                  impact_tags: a.impact_tags,
                },
                gaps: gapRows,
              },
              { onSuccess: (capId) => navigate({ to: "/capability/$assessmentId", params: { assessmentId: capId } }) },
            )
          }
        />
      ) : null}

      <ObservationDialog
        open={obsOpen}
        onOpenChange={(v) => {
          setObsOpen(v);
          if (!v) setEditing(null);
        }}
        domainCode={domainCode}
        initial={editing}
        onUploadPhoto
        saving={observations.add.isPending || observations.update.isPending}
        onSave={saveObservation}
      />

      <QuickCaptureDialog
        open={quickOpen}
        onOpenChange={setQuickOpen}
        saving={quick.add.isPending}
        onSave={(values) =>
          quick.add.mutate(
            {
              note: values.note || null,
              area: values.area || null,
              machine: values.machine || null,
              domain_code: values.domain_code,
              potential_problem: values.potential_problem || null,
            },
            {
              onSuccess: (id) => {
                if (values.photo) {
                  upload.mutate({
                    file: values.photo,
                    caption: `quick:${id}`,
                    area: values.area || null,
                    machine: values.machine || null,
                    domainCode: values.domain_code,
                  });
                }
                setQuickOpen(false);
              },
            },
          )
        }
      />
    </div>
  );
}

/* ------------------------------- baseline UI ------------------------------ */

function BaselineStrip({
  gapCount,
  areas,
}: {
  baseline: ReturnType<typeof fieldBaseline>;
  gapCount: number;
  areas: AreaBaseline[];
}) {
  const walked = areas.filter((a) => a.status !== "Requires Assessment").length;
  const constrained = areas.filter((a) => a.status === "Constrained").length;
  const opportunities = areas.filter((a) => a.status === "Opportunity Identified").length;
  const coverage = Math.round((walked / areas.length) * 100);
  return (
    <div className="panel grid gap-4 px-5 py-4 sm:grid-cols-4">
      <Stat label="Areas walked" value={`${walked} / ${areas.length}`} />
      <Stat label="Coverage" value={`${coverage}%`} />
      <Stat label="Constrained / opportunity" value={`${constrained} / ${opportunities}`} />
      <Stat label="Preliminary findings" value={String(gapCount)} />
      <p className="text-xs text-muted-foreground sm:col-span-4">
        Preliminary field baseline from a limited walkthrough. It indicates where capability appears
        constrained; it is not a full capability assessment and does not confirm root cause.
      </p>
    </div>
  );
}


function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="eyebrow">{label}</p>
      <p className="metric text-2xl font-semibold text-foreground">{value}</p>
    </div>
  );
}

/* --------------------------------- intake -------------------------------- */

function IntakeTab({
  assessment,
  locked,
  set,
}: {
  assessment: Record<string, any>;
  locked: boolean;
  set: (values: Record<string, unknown>) => void;
}) {
  return (
    <div className="space-y-4">
      <Panel title="Assessment header" subtitle="Client, facility and Ironclad assessors">
        <div className="grid gap-3 sm:grid-cols-2">
          <AutoField label="Client" required value={assessment['client_name']} disabled={locked} onCommit={(v) => set({ client_name: v })} />
          <AutoField label="Facility" required value={assessment['facility_name']} disabled={locked} onCommit={(v) => set({ facility_name: v })} />
          <AutoField label="Location" value={assessment['facility_location']} disabled={locked} onCommit={(v) => set({ facility_location: v })} />
          <AutoField label="Ironclad assessors" required value={assessment['assessors']} disabled={locked} onCommit={(v) => set({ assessors: v })} />

          <AutoField label="Client contact" value={assessment['client_contact']} disabled={locked} onCommit={(v) => set({ client_contact: v })} />
          <AutoField label="Contact title" value={assessment['client_contact_title']} disabled={locked} onCommit={(v) => set({ client_contact_title: v })} />
        </div>
        <div className="mt-3">
          <TagPicker
            label="Assessment status"
            single
            options={[...ASSESSMENT_STATUSES]}
            selected={assessment['assessment_status'] ? [assessment['assessment_status']] : []}
            disabled={locked}
            onChange={(v) => set({ assessment_status: v[0] ?? "Draft" })}
          />
        </div>
      </Panel>

      <Panel
        title="Client-stated problem"
        subtitle="Five discovery questions — capture the client's words, not your interpretation"
      >
        <div className="grid gap-3">
          <AutoField
            label="1. What is having the greatest impact on production right now?"
            value={assessment['problem_statement']}
            multiline
            disabled={locked}
            onCommit={(v) => set({ problem_statement: v })}
          />
          <p className="eyebrow">2. Where is it happening?</p>
          <div className="grid gap-3 sm:grid-cols-4">
            <AutoField label="Department" value={assessment['problem_department']} disabled={locked} onCommit={(v) => set({ problem_department: v })} />
            <AutoField label="Machine" value={assessment['problem_machine']} disabled={locked} onCommit={(v) => set({ problem_machine: v })} />
            <AutoField label="Cell" value={assessment['problem_cell']} disabled={locked} onCommit={(v) => set({ problem_cell: v })} />
            <AutoField label="Shift / timing" value={assessment['problem_timing']} disabled={locked} onCommit={(v) => set({ problem_timing: v })} />
          </div>
          <TagPicker
            label="3. What effect is it having?"
            options={PROBLEM_IMPACT_OPTIONS}
            selected={assessment['impact_tags'] ?? []}
            disabled={locked}
            onChange={(impact_tags) => set({ impact_tags })}
          />
          <AutoField
            label="Impact notes"
            value={assessment['impact_notes']}
            multiline
            rows={2}
            disabled={locked}
            onCommit={(v) => set({ impact_notes: v })}
          />
          <AutoField
            label="4. What has already been tried?"
            value={assessment['attempted']}
            multiline
            disabled={locked}
            onCommit={(v) => set({ attempted: v })}
          />
          <AutoField
            label="5. What would improve if this were resolved?"
            value={assessment['improvement_if_resolved']}
            multiline
            disabled={locked}
            onCommit={(v) => set({ improvement_if_resolved: v })}
          />
        </div>
      </Panel>

      <Panel title="Grede focus areas" subtitle="Customer-scoped template — applies to this assessment only">
        <TagPicker
          options={GREDE_FOCUS_AREAS}
          selected={assessment['workstreams'] ?? []}
          disabled={locked}
          onChange={(workstreams) => set({ workstreams })}
        />
      </Panel>
    </div>
  );
}

/* ------------------------------ domain panel ------------------------------ */

function DomainPanel({
  code,
  observations,
  attachments,
  gaps,
  locked,
  onAdd,
  onEdit,
  onDelete,
  onCreateGap,
}: {
  code: string;
  observations: FieldCaptureObservationRow[];
  attachments: ReturnType<typeof useFieldCapture>["data"] extends infer T ? any[] : any[];
  gaps: FieldCapabilityGap[];
  locked: boolean;
  onAdd: () => void;
  onEdit: (row: FieldCaptureObservationRow) => void;
  onDelete: (id: string) => void;
  onCreateGap: (row: FieldCaptureObservationRow) => void;
}) {
  const domain = domainByCode(code);
  if (!domain) return null;
  const rows = observations.filter((o) => o.domain_code === code);

  return (
    <Panel
      title={`${domain.number}. ${domain.title}`}
      subtitle={domain.question}
      actions={
        <Button size="sm" disabled={locked} onClick={onAdd}>
          <Plus className="size-4" aria-hidden /> Add observation
        </Button>
      }
    >
      <div className="rounded-sm border border-dashed border-border p-3">
        <p className="eyebrow">Observation categories</p>
        <p className="mt-2 text-xs text-muted-foreground">{domain.categories.join(" · ")}</p>
      </div>


      <div className="mt-4 grid gap-3">
        {rows.length === 0 ? (
          <EmptyState message="No observations recorded in this domain yet." />
        ) : (
          rows.map((row) => (
            <ObservationCard
              key={row.id}
              row={row}
              attachments={attachments.filter((at: any) => at.observation_id === row.id)}
              hasGap={gaps.some((g) => g.observation_id === row.id)}
              onEdit={() => onEdit(row)}
              onDelete={() => onDelete(row.id)}
              onCreateGap={() => onCreateGap(row)}
            />
          ))
        )}
      </div>
    </Panel>
  );
}

/* --------------------------------- gaps ---------------------------------- */

function GapsTab({
  gaps,
  attachments,
  locked,
  onAdd,
  onUpdate,
  onDelete,
  onUpload,
  onRemoveEvidence,
  uploading,
}: {
  gaps: FieldCapabilityGap[];
  attachments: any[];
  locked: boolean;
  onAdd: () => void;
  onUpdate: (id: string, values: Partial<FieldCapabilityGap>) => void;
  onDelete: (id: string) => void;
  onUpload: (gapId: string, file: File) => void;
  onRemoveEvidence: (row: any) => void;
  uploading: boolean;
}) {
  return (
    <Panel
      title="Capability gaps"
      subtitle="Each gap carries its evidence, the missing capability and the Ironclad bridge to the expected operational result."
      actions={
        <Button size="sm" disabled={locked} onClick={onAdd}>
          <Plus className="size-4" aria-hidden /> Add gap
        </Button>
      }
    >
      {gaps.length === 0 ? (
        <EmptyState message="No capability gaps yet. Create one from an observation during the walk." />
      ) : (
        <div className="grid gap-4">
          {gaps.map((g, i) => (
            <EntryCard
              key={g.id}
              title={`Gap #${g.gap_number ?? i + 1}${g.title ? ` — ${g.title}` : ""}`}
              disabled={locked}
              onDelete={() => onDelete(g.id)}
            >
              <AutoField label="Title" value={g.title} disabled={locked} onCommit={(v) => onUpdate(g.id, { title: v })} />
              <AutoField
                label="Area / machine / cell"
                value={g.location}
                disabled={locked}
                onCommit={(v) => onUpdate(g.id, { location: v })}
              />
              <AutoField
                label="Observed condition"
                value={g.observed_condition}
                multiline
                disabled={locked}
                onCommit={(v) => onUpdate(g.id, { observed_condition: v })}
              />
              <AutoField
                label="Objective evidence"
                value={g.objective_evidence}
                multiline
                disabled={locked}
                onCommit={(v) => onUpdate(g.id, { objective_evidence: v })}
              />
              <TagPicker
                label="Evidence classification"
                single
                options={EVIDENCE_CLASSES}
                selected={g.evidence_class ? [g.evidence_class] : []}
                disabled={locked}
                onChange={(v) => onUpdate(g.id, { evidence_class: v[0] ?? null })}
              />
              <AutoField
                label="Capability missing or constrained"
                value={g.missing_capability}
                multiline
                disabled={locked}
                onCommit={(v) => onUpdate(g.id, { missing_capability: v })}
              />
              <TagPicker
                label="Production impact"
                options={PRODUCTION_IMPACT_OPTIONS}
                selected={g.impact_tags ?? []}
                disabled={locked}
                onChange={(impact_tags) => onUpdate(g.id, { impact_tags })}
              />
              <div className="grid gap-3 sm:grid-cols-3">
                <TagPicker
                  label="Severity"
                  single
                  options={GAP_SEVERITY}
                  selected={g.severity ? [g.severity] : []}
                  disabled={locked}
                  onChange={(v) => onUpdate(g.id, { severity: v[0] ?? null })}
                />
                <TagPicker
                  label="Frequency"
                  single
                  options={GAP_FREQUENCY}
                  selected={g.frequency ? [g.frequency] : []}
                  disabled={locked}
                  onChange={(v) => onUpdate(g.id, { frequency: v[0] ?? null })}
                />
                <TagPicker
                  label="Assessor confidence"
                  single
                  options={ASSESSOR_CONFIDENCE}
                  selected={g.confidence ? [g.confidence] : []}
                  disabled={locked}
                  onChange={(v) => onUpdate(g.id, { confidence: v[0] ?? null })}
                />
              </div>
              <TagPicker
                label="Likely root capability domain"
                single
                options={ROOT_CAPABILITY_DOMAINS}
                selected={g.root_capability ? [g.root_capability] : []}
                disabled={locked}
                onChange={(v) => onUpdate(g.id, { root_capability: v[0] ?? null })}
              />

              <p className="eyebrow pt-1">Ironclad bridge</p>
              <div className="rounded-sm border border-dashed border-border p-3">
                <div className="grid gap-3">
                  <AutoField
                    label="Current state"
                    value={g.current_state}
                    multiline
                    rows={2}
                    disabled={locked}
                    onCommit={(v) => onUpdate(g.id, { current_state: v })}
                  />
                  <AutoField
                    label="Capability needed"
                    value={g.capability_needed}
                    multiline
                    rows={2}
                    disabled={locked}
                    onCommit={(v) => onUpdate(g.id, { capability_needed: v })}
                  />
                  <TagPicker
                    label="Potential Ironclad action"
                    options={IRONCLAD_ACTIONS}
                    selected={g.ironclad_actions ?? []}
                    disabled={locked}
                    onChange={(ironclad_actions) => onUpdate(g.id, { ironclad_actions })}
                  />
                  <AutoField
                    label="Expected operational result (qualitative — no promised numbers)"
                    value={g.expected_result}
                    multiline
                    rows={2}
                    disabled={locked}
                    onCommit={(v) => onUpdate(g.id, { expected_result: v })}
                  />
                </div>
              </div>

              <EvidenceStrip
                rows={attachments.filter((at) => at.gap_id === g.id)}
                uploading={uploading}
                onUpload={(file) => onUpload(g.id, file)}
                onDelete={onRemoveEvidence}
              />

              <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                <input
                  type="checkbox"
                  checked={g.is_top_finding}
                  disabled={locked}
                  onChange={(e) => onUpdate(g.id, { is_top_finding: e.target.checked })}
                />
                Top field finding
              </label>
            </EntryCard>
          ))}
        </div>
      )}
    </Panel>
  );
}

/* ------------------------------ priority tab ------------------------------ */

function PriorityTab({
  gaps,
  locked,
  onUpdate,
}: {
  gaps: FieldCapabilityGap[];
  locked: boolean;
  onUpdate: (id: string, values: Partial<FieldCapabilityGap>) => void;
}) {
  if (gaps.length === 0) return <EmptyState message="Capture capability gaps first." />;
  return (
    <div className="space-y-4">
      <Panel title="Opportunity matrix" subtitle="Impact, effort, urgency and Ironclad fit drive the suggested priority">
        <div className="grid gap-4">
          {gaps.map((g, i) => (
            <div key={g.id} className="rounded-sm border border-border p-4">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                <div className="min-w-0">
                  <p className="eyebrow">Gap #{g.gap_number ?? i + 1}</p>
                  <p className="truncate text-sm font-semibold text-foreground">
                    {g.title || g.observed_condition || "Capability gap"}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  {g.severity ? <Chip label={g.severity} className={severityToken[g.severity]} /> : null}
                  <Chip label={g.priority_code ?? suggestedPriority(g)} />
                </div>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <TagPicker
                  label="Operational impact"
                  single
                  options={IMPACT_LEVELS}
                  selected={g.operational_impact ? [g.operational_impact] : []}
                  disabled={locked}
                  onChange={(v) => onUpdate(g.id, { operational_impact: v[0] ?? null })}
                />
                <TagPicker
                  label="Implementation effort"
                  single
                  options={IMPACT_LEVELS}
                  selected={g.implementation_effort ? [g.implementation_effort] : []}
                  disabled={locked}
                  onChange={(v) => onUpdate(g.id, { implementation_effort: v[0] ?? null })}
                />
                <TagPicker
                  label="Urgency"
                  single
                  options={URGENCY_LEVELS}
                  selected={g.urgency ? [g.urgency] : []}
                  disabled={locked}
                  onChange={(v) => onUpdate(g.id, { urgency: v[0] ?? null })}
                />
                <TagPicker
                  label="Ironclad fit"
                  single
                  options={IRONCLAD_FIT}
                  selected={g.ironclad_fit ? [g.ironclad_fit] : []}
                  disabled={locked}
                  onChange={(v) => onUpdate(g.id, { ironclad_fit: v[0] ?? null })}
                />
                <TagPicker
                  label="Priority"
                  single
                  options={PRIORITY_CODES}
                  selected={g.priority_code ? [g.priority_code] : []}
                  disabled={locked}
                  onChange={(v) => onUpdate(g.id, { priority_code: v[0] ?? null })}
                />
                <TagPicker
                  label="Priority classification"
                  single
                  options={PRIORITY_CLASSES}
                  selected={g.priority_class ? [g.priority_class] : []}
                  disabled={locked}
                  onChange={(v) => onUpdate(g.id, { priority_class: v[0] ?? null })}
                />
              </div>
              {g.priority_class ? (
                <p className="mt-2 text-xs text-muted-foreground">{PRIORITY_CLASS_HELP[g.priority_class]}</p>
              ) : null}
              {!g.priority_code ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-3"
                  disabled={locked}
                  onClick={() => onUpdate(g.id, { priority_code: suggestedPriority(g) })}
                >
                  Apply suggested priority — {suggestedPriority(g)}
                </Button>
              ) : null}
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

/* ------------------------------ baseline tab ------------------------------ */

function BaselineTab({ baseline }: { baseline: ReturnType<typeof fieldBaseline> }) {
  return (
    <Panel
      title="Preliminary field capability baseline"
      subtitle="Coverage and confidence are reported per domain so this is never mistaken for a full assessment"
    >
      <div className="grid gap-3">
        {baseline.domains.map((d) => (
          <div key={d.domain.code} className="rounded-sm border border-border p-3">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">
                  {d.domain.number}. {d.domain.title}
                </p>
                <p className="text-xs text-muted-foreground">
                  {BAND_LABEL[d.band]} · {d.observations} observations · coverage {d.coveragePct}% ·
                  confidence {d.confidence}
                </p>
              </div>
              <p className={cn("metric shrink-0 text-2xl font-semibold", BAND_TEXT[d.band])}>
                {d.averageRating === null ? "—" : d.averageRating.toFixed(1)}
              </p>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-sm bg-muted">
              <div
                className={cn("h-full transition-all", BAND_BG[d.band])}
                style={{ width: `${((d.averageRating ?? 0) / 5) * 100}%` }}
              />
            </div>
            {d.criticalGaps > 0 ? (
              <p className="mt-2 text-xs font-semibold text-critical">{d.criticalGaps} critical gap(s)</p>
            ) : null}
          </div>
        ))}
      </div>
    </Panel>
  );
}

/* -------------------------------- report --------------------------------- */

function ReportTab({
  assessment,
  locked,
  set,
  areas,
  recommendation,
  gaps,
  observations,
  aiBusy,
  onDraft,
  onConvert,
  converting,
}: {
  assessment: Record<string, any>;
  locked: boolean;
  set: (values: Record<string, unknown>) => void;
  areas: AreaBaseline[];
  recommendation: ReturnType<typeof recommendPath>;
  gaps: FieldCapabilityGap[];
  observations: FieldCaptureObservationRow[];
  aiBusy: boolean;
  onDraft: () => void;
  onConvert: () => void;
  converting: boolean;
}) {
  const top = gaps.filter((g) => g.is_top_finding);
  const walked = areas.filter((a) => a.status !== "Requires Assessment");
  const constrained = areas.filter((a) => a.status === "Constrained");
  const mostSignificant = top[0] ?? gaps[0] ?? null;
  const impacts = gaps
    .map((g) => g.operational_impact_text)
    .filter((v): v is string => Boolean(v && v.trim()));
  const opportunities = gaps.filter((g) => g.opp_service);

  return (
    <div className="space-y-4">
      <Panel
        title="Executive summary"
        subtitle="AI drafts from your recorded material only. Review and edit before it leaves the building."
        actions={
          <div className="no-print flex gap-2">
            <Button size="sm" variant="outline" disabled={aiBusy || locked} onClick={onDraft}>
              {aiBusy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Sparkles className="size-4" aria-hidden />}
              Draft with AI
            </Button>
            <Button size="sm" variant="outline" onClick={() => window.print()}>
              <Printer className="size-4" aria-hidden /> Print / PDF
            </Button>
          </div>
        }
      >
        <AutoField
          value={assessment['executive_summary']}
          multiline
          rows={14}
          disabled={locked}
          onCommit={(v) => set({ executive_summary: v })}
        />
      </Panel>

      <Panel title="Report preview" subtitle="What the client receives">
        <article className="space-y-4 text-sm">
          <header>
            <p className="eyebrow">Ironclad Sustainment Solutions</p>
            <h2 className="text-lg font-semibold uppercase tracking-wide text-foreground">
              Field Capability Assessment — {assessment['client_name'] ?? "Client"}
            </h2>
            <p className="text-xs text-muted-foreground">
              {[assessment['facility_name'], assessment['facility_location'], assessment['assessment_date']]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </header>

          <section>
            <p className="eyebrow">Scope of this visit</p>
            <p className="text-foreground">
              {walked.length} of {areas.length} capability areas walked · {observations.length}{" "}
              observations recorded · {constrained.length} areas appear constrained
            </p>
          </section>

          <section>
            <p className="eyebrow">Client-stated problem</p>
            <p className="whitespace-pre-wrap text-foreground">{assessment['problem_statement'] || "—"}</p>
          </section>

          <section>
            <p className="eyebrow">Field capability snapshot</p>
            <ul className="grid gap-1 sm:grid-cols-2">
              {areas.map((a) => (
                <li key={a.area.code} className="flex items-baseline justify-between gap-3">
                  <span className="text-foreground">{a.area.title}</span>
                  <span className={cn("text-xs font-semibold", STATUS_TEXT[a.status])}>{a.status}</span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <p className="eyebrow">Preliminary findings</p>
            {top.length === 0 ? (
              <p className="text-muted-foreground">No findings flagged as top yet.</p>
            ) : (
              <ol className="list-decimal space-y-2 pl-4">
                {top.map((g) => (
                  <li key={g.id}>
                    <p className="font-semibold text-foreground">{g.title || g.observed_condition}</p>
                    <p className="text-xs text-muted-foreground">
                      {[areaTitle(g.focus_area), g.severity, g.priority_code, g.evidence_class]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    {g.operational_impact_text ? (
                      <p className="text-xs text-muted-foreground">
                        Operational impact: {g.operational_impact_text}
                      </p>
                    ) : null}
                    {g.validation_needed ? (
                      <p className="text-xs text-muted-foreground">
                        Validation required: {g.validation_needed}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section>
            <p className="eyebrow">Most significant observed constraint</p>
            <p className="whitespace-pre-wrap text-foreground">
              {mostSignificant
                ? [
                    mostSignificant.title || mostSignificant.observed_condition,
                    mostSignificant.preliminary_constraint,
                  ]
                    .filter(Boolean)
                    .join(" — ")
                : "No constraint has been prioritised yet."}
            </p>
          </section>

          <section>
            <p className="eyebrow">Operational impact</p>
            {impacts.length === 0 ? (
              <p className="text-muted-foreground">No operational impact has been recorded yet.</p>
            ) : (
              <ul className="list-disc space-y-1 pl-4 text-foreground">
                {impacts.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <p className="eyebrow">Where Ironclad can support</p>
            {opportunities.length === 0 ? (
              <p className="text-muted-foreground">No support areas identified yet.</p>
            ) : (
              <ul className="list-disc space-y-1 pl-4 text-foreground">
                {opportunities.map((g) => (
                  <li key={g.id}>
                    {g.opp_service}
                    {g.opp_scope ? ` — ${g.opp_scope}` : ""}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <p className="eyebrow">Recommended next step</p>
            <p className="text-foreground">
              {(assessment['recommended_path'] as string) || recommendation.path || "To be determined."}
            </p>
            <p className="text-xs text-muted-foreground">{recommendation.rationale}</p>
          </section>


          <section>
            <p className="eyebrow">Preliminary conclusion</p>
            <AutoField
              value={assessment['preliminary_conclusion'] ?? DEFAULT_CONCLUSION}
              multiline
              rows={6}
              disabled={locked}
              onCommit={(v) => set({ preliminary_conclusion: v })}
            />
          </section>

          <p className="text-xs text-muted-foreground">
            This document reflects a limited onsite walkthrough. Observations marked Reported, Inferred or
            Requires Validation have not been independently verified. Restore Capability. Preserve Readiness.®
          </p>
        </article>
      </Panel>

      <Panel
        title="Launch full capability assessment"
        subtitle="Carries the client problem, findings and evidence into a full IronIQ Capability Assessment"
      >
        <Button disabled={converting || locked} onClick={onConvert}>
          {converting ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <ArrowRight className="size-4" aria-hidden />}
          Launch full capability assessment
        </Button>
      </Panel>

      <div className="no-print">
        <Button
          size="lg"
          className="h-12 w-full"
          onClick={() => set({ assessment_status: locked ? "In Review" : "Delivered", status: locked ? "open" : "submitted" })}
        >
          <Check className="size-4" aria-hidden />
          {locked ? "Reopen assessment" : "Mark delivered"}
        </Button>
      </div>
    </div>
  );
}
