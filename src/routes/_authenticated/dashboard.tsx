import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, ShieldAlert } from "lucide-react";
import {
  PageHeader,
  Panel,
  EmptyState,
} from "@/components/ironiq/layout-primitives";
import {
  ScoreDial,
  StatCard,
  CategoryBar,
} from "@/components/ironiq/score-visuals";
import {
  CategoryRadar,
  TrendLine,
  SeverityDonut,
} from "@/components/ironiq/charts";
import { CriticalRiskBanner } from "@/components/ironiq/critical-banner";
import {
  ReadinessBadge,
  SeverityBadge,
  FindingStatusBadge,
} from "@/components/ironiq/badges";
import { useApp } from "@/context/app-context";
import {
  useFacilityResult,
  useAssessmentResult,
} from "@/lib/use-facility-result";
import { CategoryDetailSheet } from "@/components/ironiq/category-detail-sheet";
import { useFindings, useProjects, useReadinessHistory } from "@/lib/api";
import { SEVERITY_ORDER, type FindingSeverity } from "@/lib/domain";
import { formatScore } from "@/lib/scoring";
import { formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useFacilityTrendSummary } from "@/lib/facility-trend-api";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Readiness Dashboard — IronIQ" },
      {
        name: "description",
        content:
          "Facility readiness score, confidence score, category performance, critical risks and improvement pipeline at a glance.",
      },
      { property: "og:title", content: "Readiness Dashboard — IronIQ" },
      {
        property: "og:description",
        content:
          "Manufacturing readiness performance for your selected facility.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { facility, organization } = useApp();
  const { assessment, result, loading } = useFacilityResult(facility?.id);
  const findings = useFindings(facility?.id).data ?? [];
  const projects = useProjects(facility?.id).data ?? [];
  const history = useReadinessHistory(facility?.id).data ?? [];
  const trendSummary = useFacilityTrendSummary();
  const { questions, responses } = useAssessmentResult(assessment);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    null,
  );
  const selectedCategory =
    result?.categories.find((c) => c.category.id === selectedCategoryId) ??
    null;

  const openFindings = findings.filter(
    (f) => !["closed", "accepted_risk"].includes(f.status),
  );
  const severityCounts = SEVERITY_ORDER.reduce(
    (acc, s) => ({
      ...acc,
      [s]: findings.filter((f) => f.severity === s).length,
    }),
    {} as Record<FindingSeverity, number>,
  );

  const topRisks = [...openFindings]
    .sort(
      (a, b) =>
        SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity),
    )
    .slice(0, 5);

  const activeProjects = projects.filter(
    (p) => p.status === "in_progress" || p.status === "planned",
  );
  const projectedValue = projects.reduce(
    (s, p) => s + Number(p.estimated_financial_impact ?? 0),
    0,
  );

  const radarData =
    result?.categories
      .filter((c) => c.score !== null)
      .map((c) => ({ category: c.category.code, score: c.score as number })) ??
    [];

  const trendData = history.map((h) => ({
    period: h.period_label,
    readiness: Number(h.overall_score),
    confidence: h.confidence_score === null ? null : Number(h.confidence_score),
  }));

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <PageHeader
        eyebrow={organization?.name ?? "IronIQ"}
        title={facility?.name ?? "Readiness Dashboard"}
        description={
          facility
            ? `${facility.address ?? "Location on file"} · ${facility.primary_processes ?? "Manufacturing"} · Manufacturing readiness performance`
            : "Select a facility to view readiness performance."
        }
        actions={
          <>
            <Button variant="outline" asChild>
              <Link to="/reports">Generate report</Link>
            </Button>
            <Button asChild>
              <Link to="/assessments">
                Assessments <ArrowUpRight className="size-4" aria-hidden />
              </Link>
            </Button>
          </>
        }
      />

      {loading ? (
        <EmptyState message="Loading readiness data…" />
      ) : !result ? (
        <EmptyState message="No assessment data available for this facility yet." />
      ) : (
        <>
          <section className="grid gap-4 lg:grid-cols-[320px_1fr]">
            <div className="panel flex flex-col items-center justify-center gap-4 px-6 py-8">
              <ScoreDial
                value={result.overallScore}
                label="Manufacturing Readiness Score"
                level={result.readinessLevel}
              />
              <ReadinessBadge level={result.readinessLevel} />
              {result.gated ? (
                <p className="flex items-start gap-1.5 text-center text-xs text-critical">
                  <ShieldAlert
                    className="mt-0.5 size-3.5 shrink-0"
                    aria-hidden
                  />
                  Capped from {result.rawReadinessLevel} by the critical-control
                  gate.
                </p>
              ) : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                label="Confidence Score"
                value={formatScore(result.confidenceScore)}
                unit="%"
                hint="Evidence strength behind the score"
                token="primary"
              />
              <StatCard
                label="Assessment Completion"
                value={formatScore(result.completionPct)}
                unit="%"
                hint={`${result.answered} of ${result.applicable} applicable questions`}
              />
              <StatCard
                label="Open Findings"
                value={openFindings.length}
                hint={`${severityCounts.critical ?? 0} critical · ${severityCounts.high ?? 0} high`}
                token={openFindings.length > 0 ? "high" : "success"}
              />
              <StatCard
                label="Active Projects"
                value={activeProjects.length}
                hint={
                  projectedValue > 0
                    ? `$${(projectedValue / 1000).toFixed(0)}k projected impact`
                    : "No financial impact modelled"
                }
                token="success"
              />
            </div>
          </section>

          <CriticalRiskBanner
            failures={result.criticalFailures}
            gated={result.gated}
          />

          <section className="grid gap-4 lg:grid-cols-2">
            <Panel
              title="Category Performance"
              subtitle="Select a category to see its questions, scores and findings"
            >
              <div className="space-y-4">
                {result.categories.map((c) => (
                  <CategoryBar
                    key={c.category.id}
                    name={c.category.name}
                    weight={Number(c.category.weight)}
                    score={c.score}
                    onSelect={() => setSelectedCategoryId(c.category.id)}
                  />
                ))}
              </div>
            </Panel>

            <Panel
              title="Readiness Profile"
              subtitle="Category scores mapped against the 100-point scale"
            >
              {radarData.length > 0 ? (
                <CategoryRadar data={radarData} />
              ) : (
                <EmptyState message="No scored categories yet." />
              )}
            </Panel>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <Panel
              title="Readiness Trend"
              subtitle="Score progression across assessment cycles"
            >
              {trendData.length > 1 ? (
                <div className="space-y-3">
                  <TrendLine data={trendData} />
                  <div className="border-t border-border pt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!facility || trendSummary.isPending}
                      onClick={() =>
                        facility && trendSummary.mutate(facility.id)
                      }
                    >
                      {trendSummary.isPending
                        ? "Summarizing…"
                        : "Summarize what's changed since last visit"}
                    </Button>
                    {trendSummary.data ? (
                      <p className="mt-3 text-sm text-muted-foreground">
                        {trendSummary.data.summary}
                      </p>
                    ) : null}
                  </div>
                </div>
              ) : (
                <EmptyState message="At least two assessment cycles are required to trend." />
              )}
            </Panel>

            <Panel
              title="Findings by Severity"
              subtitle={`${findings.length} total findings recorded`}
            >
              <SeverityDonut counts={severityCounts} />
            </Panel>
          </section>

          <Panel
            title="Top Risks"
            subtitle="Highest-severity open findings requiring executive attention"
            actions={
              <Button variant="ghost" size="sm" asChild>
                <Link to="/findings">View all</Link>
              </Button>
            }
          >
            {topRisks.length === 0 ? (
              <EmptyState message="No open findings. All corrective actions are closed." />
            ) : (
              <ul className="divide-y divide-border">
                {topRisks.map((f) => (
                  <li
                    key={f.id}
                    className="flex flex-col gap-2 py-4 first:pt-0 last:pb-0 md:flex-row md:items-start md:gap-4"
                  >
                    <div className="flex shrink-0 items-center gap-2">
                      <SeverityBadge severity={f.severity} />
                      <span className="metric text-xs text-muted-foreground">
                        {f.finding_code}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">
                        {f.description}
                      </p>
                      {f.recommended_action ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          <span className="font-semibold text-foreground/80">
                            Recommended:{" "}
                          </span>
                          {f.recommended_action}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <FindingStatusBadge status={f.status} />
                      <span className="metric text-xs text-muted-foreground">
                        {formatDate(f.target_date)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <CategoryDetailSheet
            detail={selectedCategory}
            questions={questions}
            responses={responses}
            findings={findings}
            assessmentId={assessment?.id}
            onOpenChange={(open) => {
              if (!open) setSelectedCategoryId(null);
            }}
          />

          {assessment ? (
            <p className="text-xs text-muted-foreground">
              Scores derived from{" "}
              <span className="text-foreground">{assessment.name}</span> ·{" "}
              {formatDate(assessment.assessment_date)} · lead assessor{" "}
              {assessment.lead_assessor ?? "unassigned"}.
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
