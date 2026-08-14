import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { PageHeader, Panel, EmptyState } from "@/components/ironiq/layout-primitives";
import { AssessmentStatusBadge, ReadinessBadge } from "@/components/ironiq/badges";
import { useApp } from "@/context/app-context";
import { useAssessments } from "@/lib/api";
import { formatScore, readinessLevelFor } from "@/lib/scoring";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/assessments/")({
  head: () => ({
    meta: [
      { title: "Assessments — IronIQ" },
      {
        name: "description",
        content:
          "Baseline, follow-up and pre-award manufacturing readiness assessments with status, completion and scoring.",
      },
      { property: "og:title", content: "Assessments — IronIQ" },
      { property: "og:description", content: "Manufacturing readiness assessment workflow and history." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AssessmentsPage,
});

function AssessmentsPage() {
  const { facility, can } = useApp();
  const assessments = useAssessments(facility?.id).data ?? [];

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <PageHeader
        eyebrow={facility?.name ?? "Facility"}
        title="Assessments"
        description="Every readiness assessment conducted at this facility. Scores are recomputed live from the underlying responses."
        actions={
          can("conduct_assessment") ? (
            <Button asChild>
              <Link to="/assessments/new">
                <Plus className="size-4" aria-hidden />
                New assessment
              </Link>
            </Button>
          ) : undefined
        }
      />

      {assessments.length === 0 ? (
        <EmptyState message="No assessments have been created for this facility." />
      ) : (
        <Panel>
          <div className="-mx-5 -my-5 overflow-x-auto">
            <table className="w-full min-w-[46rem] text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  {["Assessment", "Type", "Date", "Status", "Completion", "Score", "Readiness"].map((h) => (
                    <th key={h} className="eyebrow px-5 py-3 font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {assessments.map((a) => (
                  <tr key={a.id} className="transition-colors hover:bg-accent/40">
                    <td className="px-5 py-4">
                      <Link
                        to="/assessments/$assessmentId"
                        params={{ assessmentId: a.id }}
                        className="font-medium text-foreground underline-offset-4 hover:text-primary hover:underline"
                      >
                        {a.name}
                      </Link>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {a.lead_assessor ?? "Unassigned"} · {a.production_area ?? "Full site"}
                      </p>
                    </td>
                    <td className="px-5 py-4 capitalize text-muted-foreground">
                      {a.assessment_type?.replace(/_/g, " ") ?? "—"}
                    </td>
                    <td className="metric px-5 py-4 text-muted-foreground">{a.assessment_date}</td>
                    <td className="px-5 py-4">
                      <AssessmentStatusBadge status={a.status} />
                    </td>
                    <td className="metric px-5 py-4">{formatScore(a.completion_pct, "%")}</td>
                    <td className="metric px-5 py-4 font-semibold">{formatScore(a.overall_score)}</td>
                    <td className="px-5 py-4">
                      {/* Readiness is only rated once the assessment is fully scored. */}
                      <ReadinessBadge
                        level={
                          a.overall_score === null || Number(a.completion_pct) < 100
                            ? null
                            : ((a.readiness_level as never) ??
                              readinessLevelFor(Number(a.overall_score)))
                        }
                      />
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </div>
  );
}
