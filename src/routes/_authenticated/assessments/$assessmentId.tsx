import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import {
  PageHeader,
  Panel,
  EmptyState,
  DefinitionList,
} from "@/components/ironiq/layout-primitives";
import {
  AssessmentStatusBadge,
  ReadinessBadge,
  Tag,
} from "@/components/ironiq/badges";
import { ScoreDial, CategoryBar } from "@/components/ironiq/score-visuals";
import { CriticalRiskBanner } from "@/components/ironiq/critical-banner";
import { useApp } from "@/context/app-context";
import { useAssessment, logAudit } from "@/lib/api";
import { useAssessmentResult } from "@/lib/use-facility-result";
import { upsertAssessmentResponse } from "@/lib/api.functions";
import {
  EVIDENCE_LABELS,
  SCORE_ANCHORS,
  type EvidenceType,
  type AssessmentResponse,
} from "@/lib/domain";
import {
  formatScore,
  isValidScore,
  computeAssessmentResult,
} from "@/lib/scoring";
import { formatDate } from "@/lib/utils";
import {
  persistAssessmentAggregates,
  syncCriticalFindings,
} from "@/lib/assessment-workflow";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export const Route = createFileRoute(
  "/_authenticated/assessments/$assessmentId",
)({
  head: () => ({
    meta: [
      { title: "Assessment Workspace — IronIQ" },
      {
        name: "description",
        content:
          "Score readiness questions on the 0–5 maturity scale, attach evidence, and watch category and overall scores recalculate live.",
      },
      { property: "og:title", content: "Assessment Workspace — IronIQ" },
      {
        property: "og:description",
        content: "Evidence-graded readiness scoring workspace.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AssessmentDetail,
});

function AssessmentDetail() {
  const { assessmentId } = Route.useParams();
  const { profile, can } = useApp();
  const queryClient = useQueryClient();
  const assessmentQuery = useAssessment(assessmentId);
  const assessment = assessmentQuery.data ?? null;
  const { result, categories, questions, responses, loading } =
    useAssessmentResult(assessment);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const readOnly =
    !can("conduct_assessment") || assessment?.status === "finalized";

  const saveResponse = useMutation({
    mutationFn: async (payload: {
      question_id: string;
      score?: number | null;
      not_applicable?: boolean;
      comments?: string | null;
      evidence_type?: EvidenceType;
    }) => {
      if (!assessment) throw new Error("Assessment not loaded");
      if (assessment.status === "finalized") {
        throw new Error(
          "This assessment is finalized and read-only. Reopen it to make changes.",
        );
      }
      if (
        payload.score !== undefined &&
        payload.score !== null &&
        !isValidScore(payload.score)
      ) {
        throw new Error("Score must be a whole number between 0 and 5.");
      }

      const existing = responses.find(
        (r) => r.question_id === payload.question_id,
      );
      const notApplicable =
        payload.not_applicable !== undefined
          ? payload.not_applicable
          : (existing?.not_applicable ?? false);
      // Marking a question N/A clears its score so it can never influence maths.
      const score = notApplicable
        ? null
        : payload.score !== undefined
          ? payload.score
          : (existing?.score ?? null);

      const row = {
        assessment_id: assessmentId,
        question_id: payload.question_id,
        score,
        not_applicable: notApplicable,
        comments:
          payload.comments !== undefined
            ? payload.comments
            : (existing?.comments ?? null),
        evidence_type:
          payload.evidence_type ?? existing?.evidence_type ?? "none",
        answered_at: score === null ? null : new Date().toISOString(),
        answered_by: score === null ? null : (profile?.id ?? null),
      };
      await upsertAssessmentResponse({ data: row });

      // Recompute from the full response set and roll the result up so lists,
      // dashboards and reports stay consistent with a resumable draft.
      const nextResponses = [
        ...responses.filter((r) => r.question_id !== payload.question_id),
        { ...(existing ?? {}), ...row } as AssessmentResponse,
      ];
      const nextResult = computeAssessmentResult(
        categories,
        questions,
        nextResponses,
      );
      await persistAssessmentAggregates(assessmentId, nextResult, {
        status:
          assessment.status === "draft" ? "in_progress" : assessment.status,
        updated_by: profile?.id ?? null,
      });
      await syncCriticalFindings(
        assessment,
        categories,
        questions,
        nextResponses,
        profile?.id,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["responses", assessmentId] });
      queryClient.invalidateQueries({ queryKey: ["assessment", assessmentId] });
      queryClient.invalidateQueries({ queryKey: ["assessments"] });
      queryClient.invalidateQueries({ queryKey: ["findings"] });
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Could not save response"),
  });

  const setStatus = useMutation({
    mutationFn: async (
      status: "in_progress" | "review" | "finalized" | "reopened",
    ) => {
      if (!result || !assessment) throw new Error("Scores not ready");
      if (status === "finalized" && !result.isComplete) {
        throw new Error(
          `All applicable questions must be answered before finalizing (${result.answered}/${result.applicable}).`,
        );
      }
      if (status === "finalized") {
        await syncCriticalFindings(
          assessment,
          categories,
          questions,
          responses,
          profile?.id,
        );
      }
      await persistAssessmentAggregates(assessmentId, result, {
        status,
        finalized_at: status === "finalized" ? new Date().toISOString() : null,
        finalized_by: status === "finalized" ? (profile?.id ?? null) : null,
        updated_by: profile?.id ?? null,
      });
      await logAudit({
        organization_id: assessment.organization_id,
        facility_id: assessment.facility_id,
        actor_name: profile?.full_name ?? null,
        action: `assessment.${status}`,
        entity_type: "assessment",
        entity_id: assessmentId,
        details: {
          overall_score: result.overallScore,
          readiness_level: result.readinessLevel,
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assessment", assessmentId] });
      queryClient.invalidateQueries({ queryKey: ["assessments"] });
      queryClient.invalidateQueries({ queryKey: ["findings"] });
      queryClient.invalidateQueries({ queryKey: ["audit-log"] });
      toast.success("Assessment status updated");
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Could not update status"),
  });

  if (assessmentQuery.isLoading || loading)
    return <EmptyState message="Loading assessment…" />;
  if (!assessment) return <EmptyState message="Assessment not found." />;

  const currentCategory = activeCategory ?? categories[0]?.id ?? "";

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link to="/assessments">
          <ArrowLeft className="size-4" aria-hidden />
          All assessments
        </Link>
      </Button>

      <PageHeader
        eyebrow={assessment.assessment_type?.replace(/_/g, " ") ?? "Assessment"}
        title={assessment.name}
        description={assessment.scope ?? undefined}
        actions={
          <>
            <AssessmentStatusBadge status={assessment.status} />
            {!readOnly && assessment.status !== "review" ? (
              <Button
                variant="outline"
                onClick={() => setStatus.mutate("review")}
              >
                Submit for review
              </Button>
            ) : null}
            {can("finalize_assessment") && assessment.status !== "finalized" ? (
              <Button
                onClick={() => setStatus.mutate("finalized")}
                disabled={!result?.isComplete || setStatus.isPending}
                title={
                  result?.isComplete
                    ? "Lock this assessment"
                    : `Answer all applicable questions first (${result?.answered ?? 0}/${result?.applicable ?? 0})`
                }
              >
                Finalize
              </Button>
            ) : null}
            {can("reopen_assessment") && assessment.status === "finalized" ? (
              <Button
                variant="outline"
                onClick={() => setStatus.mutate("reopened")}
              >
                Reopen
              </Button>
            ) : null}
          </>
        }
      />

      {assessment.status === "finalized" ? (
        <p className="rounded-sm border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">
            Finalized and read-only.
          </span>{" "}
          Scores, evidence and comments are locked. Reopen the assessment to
          make further changes.
        </p>
      ) : !can("conduct_assessment") ? (
        <p className="rounded-sm border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          You have view-only access to this assessment.
        </p>
      ) : null}

      {result ? (
        <section className="grid gap-4 lg:grid-cols-[300px_1fr]">
          <div className="panel flex flex-col items-center gap-3 px-6 py-6">
            <ScoreDial
              value={result.overallScore}
              label="Readiness Score"
              level={result.readinessLevel}
              size={130}
            />
            <ReadinessBadge level={result.readinessLevel} />
            <p className="metric text-xs text-muted-foreground">
              Confidence {formatScore(result.confidenceScore, "%")} · Complete{" "}
              {formatScore(result.completionPct, "%")}
            </p>
          </div>
          <Panel
            title="Category scores"
            subtitle="Recalculated live as responses are saved"
          >
            <div className="space-y-4">
              {result.categories.map((c) => (
                <CategoryBar
                  key={c.category.id}
                  name={`${c.category.name} (${c.answered}/${c.applicable})`}
                  weight={Number(c.category.weight)}
                  score={c.score}
                />
              ))}
            </div>
          </Panel>
        </section>
      ) : null}

      <CriticalRiskBanner
        failures={result?.criticalFailures ?? []}
        gated={result?.gated}
      />

      <Panel title="Assessment detail">
        <DefinitionList
          items={[
            {
              label: "Assessment date",
              value: formatDate(assessment.assessment_date),
            },
            { label: "Lead assessor", value: assessment.lead_assessor ?? "—" },
            {
              label: "Production area",
              value: assessment.production_area ?? "—",
            },
            {
              label: "Product family",
              value: assessment.product_family ?? "—",
            },
          ]}
        />
      </Panel>

      <Tabs value={currentCategory} onValueChange={setActiveCategory}>
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
          {categories.map((c) => (
            <TabsTrigger key={c.id} value={c.id} className="text-xs">
              {c.code} · {c.name}
            </TabsTrigger>
          ))}
        </TabsList>

        {categories.map((c) => (
          <TabsContent key={c.id} value={c.id} className="mt-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              {c.description}{" "}
              <span className="text-foreground">
                Weight {Number(c.weight)}%
              </span>
            </p>
            {questions
              .filter((q) => q.category_id === c.id)
              .map((q) => {
                const response = responses.find((r) => r.question_id === q.id);
                return (
                  <div key={q.id} className="panel space-y-4 p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="metric text-xs text-muted-foreground">
                          {q.question_code} · weight {Number(q.weight)}
                        </p>
                        <p className="mt-1 text-sm font-medium text-foreground">
                          {q.question_text}
                        </p>
                        {q.guidance_text ? (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {q.guidance_text}
                          </p>
                        ) : null}
                      </div>
                      {q.is_critical ? (
                        <Tag token="critical">Critical control</Tag>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      {SCORE_ANCHORS.map((a) => (
                        <button
                          key={a.value}
                          type="button"
                          disabled={readOnly}
                          title={`${a.label} — ${a.description}`}
                          onClick={() =>
                            saveResponse.mutate({
                              question_id: q.id,
                              score: a.value,
                              not_applicable: false,
                            })
                          }
                          className={cn(
                            "metric size-9 rounded-sm border text-sm font-semibold transition-colors disabled:opacity-50",
                            response?.score === a.value &&
                              !response?.not_applicable
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border bg-background text-muted-foreground hover:border-primary/60 hover:text-foreground",
                          )}
                        >
                          {a.value}
                        </button>
                      ))}
                      <button
                        type="button"
                        disabled={readOnly}
                        onClick={() =>
                          saveResponse.mutate({
                            question_id: q.id,
                            not_applicable: !response?.not_applicable,
                          })
                        }
                        className={cn(
                          "h-9 rounded-sm border px-3 text-xs font-semibold uppercase tracking-widest transition-colors disabled:opacity-50",
                          response?.not_applicable
                            ? "border-steel bg-muted text-foreground"
                            : "border-border text-muted-foreground hover:text-foreground",
                        )}
                      >
                        N/A
                      </button>

                      <div className="ml-auto w-52">
                        <Select
                          disabled={readOnly}
                          value={response?.evidence_type ?? "none"}
                          onValueChange={(v) =>
                            saveResponse.mutate({
                              question_id: q.id,
                              evidence_type: v as EvidenceType,
                            })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Evidence" />
                          </SelectTrigger>
                          <SelectContent>
                            {(
                              Object.keys(EVIDENCE_LABELS) as EvidenceType[]
                            ).map((e) => (
                              <SelectItem key={e} value={e}>
                                {EVIDENCE_LABELS[e]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <Textarea
                      rows={2}
                      disabled={readOnly}
                      defaultValue={response?.comments ?? ""}
                      placeholder="Observation, evidence reference or justification…"
                      onBlur={(e) =>
                        e.target.value !== (response?.comments ?? "") &&
                        saveResponse.mutate({
                          question_id: q.id,
                          comments: e.target.value,
                        })
                      }
                    />
                  </div>
                );
              })}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
