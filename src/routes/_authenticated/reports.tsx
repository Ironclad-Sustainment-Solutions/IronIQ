import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Printer } from "lucide-react";
import {
  PageHeader,
  Panel,
  EmptyState,
  DefinitionList,
} from "@/components/ironiq/layout-primitives";
import { ReadinessBadge, SeverityBadge } from "@/components/ironiq/badges";
import { CategoryBar } from "@/components/ironiq/score-visuals";
import { PartOutcomeCardView } from "@/components/ironiq/part-outcome-card";
import { useApp } from "@/context/app-context";
import { useFacilityResult } from "@/lib/use-facility-result";
import { useFindings, useProjects } from "@/lib/api";
import { usePartOutcomeCards } from "@/lib/shop-floor-api";
import { formatScore } from "@/lib/scoring";
import { SEVERITY_ORDER } from "@/lib/domain";
import { formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({
    meta: [
      { title: "Readiness Report — IronIQ" },
      {
        name: "description",
        content:
          "Executive-ready readiness report: overall score, confidence, category performance, critical risks and the improvement roadmap.",
      },
      { property: "og:title", content: "Readiness Report — IronIQ" },
      {
        property: "og:description",
        content: "Print-ready executive manufacturing readiness report.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ReportsPage,
});

function ReportsPage() {
  const { facility, organization } = useApp();
  const { assessment, result } = useFacilityResult(facility?.id);
  const findings = useFindings(facility?.id).data ?? [];
  const projects = useProjects(facility?.id).data ?? [];
  const partCards =
    usePartOutcomeCards(organization?.id, facility?.id).data ?? [];
  const [printCardId, setPrintCardId] = useState<string | null>(null);

  const ranked = [...findings].sort(
    (a, b) =>
      SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity),
  );

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className={cn(printCardId && "no-print")}>
        <PageHeader
          eyebrow={organization?.name ?? "Report"}
          title="Readiness Report"
          description={
            assessment
              ? `${assessment.name} · ${formatDate(assessment.assessment_date)}`
              : undefined
          }
          actions={
            <Button variant="outline" onClick={() => window.print()}>
              <Printer className="size-4" aria-hidden />
              Print / PDF
            </Button>
          }
        />

        {!result ? (
          <EmptyState message="No finalized assessment available to report on." />
        ) : (
          <>
            <Panel title="Executive summary">
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-4">
                  <span className="metric text-5xl font-semibold text-foreground">
                    {formatScore(result.overallScore)}
                  </span>
                  <ReadinessBadge level={result.readinessLevel} />
                </div>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {facility?.name} scored {formatScore(result.overallScore)} out
                  of 100 with a confidence score of{" "}
                  {formatScore(result.confidenceScore, "%")}, based on{" "}
                  {result.answered} scored controls across{" "}
                  {result.categories.length} weighted categories.
                  {result.gated
                    ? ` Readiness is capped at Conditionally Ready because ${result.criticalFailures.length} critical control(s) failed; these must be remediated and re-verified before a production-ready determination can be issued.`
                    : " No critical control failures were identified."}
                </p>
                <DefinitionList
                  items={[
                    {
                      label: "Confidence score",
                      value: formatScore(result.confidenceScore, "%"),
                    },
                    {
                      label: "Completion",
                      value: formatScore(result.completionPct, "%"),
                    },
                    {
                      label: "Open findings",
                      value: findings.filter((f) => f.status !== "closed")
                        .length,
                    },
                    { label: "Improvement projects", value: projects.length },
                  ]}
                />
              </div>
            </Panel>

            <Panel title="Category performance">
              <div className="space-y-4">
                {result.categories.map((c) => (
                  <CategoryBar
                    key={c.category.id}
                    name={c.category.name}
                    weight={Number(c.category.weight)}
                    score={c.score}
                  />
                ))}
              </div>
            </Panel>

            <Panel title="Prioritized findings">
              <ul className="divide-y divide-border">
                {ranked.slice(0, 10).map((f) => (
                  <li
                    key={f.id}
                    className="flex flex-col gap-1.5 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="flex items-center gap-2">
                      <SeverityBadge severity={f.severity} />
                      <span className="metric text-xs text-muted-foreground">
                        {f.finding_code}
                      </span>
                    </div>
                    <p className="text-sm text-foreground">{f.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {f.recommended_action}
                    </p>
                  </li>
                ))}
              </ul>
            </Panel>

            <Panel title="Improvement roadmap">
              <ul className="divide-y divide-border">
                {projects.map((p) => (
                  <li
                    key={p.id}
                    className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <span className="min-w-0 flex-1 text-sm text-foreground">
                      {p.name}
                    </span>
                    <span className="metric text-xs text-muted-foreground">
                      {formatDate(p.planned_start)} →{" "}
                      {formatDate(p.planned_completion)}
                    </span>
                    <span className="metric text-xs font-semibold text-foreground">
                      {p.percent_complete}%
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>
          </>
        )}
      </div>

      <Panel
        title="Part before / after cards"
        subtitle="One named part, structured numbers, printable as a single page"
        className={cn(printCardId && "no-print")}
      >
        {partCards.length === 0 ? (
          <EmptyState message="No part cards yet. Verify a CNC change with before/after numbers, or record a measured result on a capability action." />
        ) : (
          <ul className="space-y-2">
            {partCards.map((card) => (
              <li
                key={card.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2"
              >
                <span className="text-sm">
                  {card.part_number}
                  {card.machine_label ? ` · ${card.machine_label}` : ""}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setPrintCardId(card.id);
                    window.setTimeout(() => window.print(), 50);
                  }}
                >
                  <Printer className="size-4" aria-hidden />
                  Print card
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {partCards.map((card) => (
        <div
          key={card.id}
          className={cn(printCardId && printCardId !== card.id && "no-print")}
        >
          <PartOutcomeCardView
            card={card}
            printable={printCardId === card.id || !printCardId}
          />
        </div>
      ))}
    </div>
  );
}
