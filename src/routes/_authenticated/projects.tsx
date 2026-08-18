import { createFileRoute } from "@tanstack/react-router";
import { Pencil } from "lucide-react";
import {
  PageHeader,
  Panel,
  EmptyState,
} from "@/components/ironiq/layout-primitives";
import { ProjectStatusBadge } from "@/components/ironiq/badges";
import { StatCard } from "@/components/ironiq/score-visuals";
import { useApp } from "@/context/app-context";
import { useFindings, useProjects } from "@/lib/api";
import { useProjectFindings } from "@/lib/mutations";
import { formatDate } from "@/lib/utils";
import {
  ProjectFindingsDialog,
  ImprovementProjectDialog,
} from "@/components/ironiq/entity-dialogs";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/projects")({
  head: () => ({
    meta: [
      { title: "Improvement Projects — IronIQ" },
      {
        name: "description",
        content:
          "Improvement projects linked to readiness gaps, with sponsor, objective, baseline and target metrics, financial impact and progress.",
      },
      { property: "og:title", content: "Improvement Projects — IronIQ" },
      {
        property: "og:description",
        content: "Improvement portfolio driving readiness score gains.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProjectsPage,
});

function ProjectsPage() {
  const { organization, facility, can } = useApp();
  const projects = useProjects(facility?.id).data ?? [];
  const findings = useFindings(facility?.id).data ?? [];
  const links = useProjectFindings(projects.map((p) => p.id)).data ?? [];

  const impact = projects.reduce(
    (s, p) => s + Number(p.estimated_financial_impact ?? 0),
    0,
  );
  const active = projects.filter((p) => p.status === "in_progress").length;
  const complete = projects.filter((p) => p.status === "complete").length;

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <PageHeader
        eyebrow={facility?.name ?? "Facility"}
        title="Improvement Projects"
        description="The execution layer of the readiness programme — each project closes a scored gap and is tracked to measurable results."
        actions={
          can("manage_findings") && organization && facility ? (
            <ImprovementProjectDialog
              organizationId={organization.id}
              facilityId={facility.id}
              trigger={<Button>+ New project</Button>}
            />
          ) : undefined
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Projects in flight" value={active} token="primary" />
        <StatCard label="Completed" value={complete} token="success" />
        <StatCard
          label="Projected annual impact"
          value={`$${(impact / 1000).toFixed(0)}k`}
          token="success"
        />
      </div>

      {projects.length === 0 ? (
        <EmptyState message="No improvement projects for this facility." />
      ) : (
        <div className="space-y-4">
          {projects.map((p) => (
            <Panel
              key={p.id}
              title={p.name}
              subtitle={p.objective ?? undefined}
            >
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <ProjectStatusBadge status={p.status} />
                  <span className="text-xs text-muted-foreground">
                    Owner {p.owner ?? "—"} · Sponsor{" "}
                    {p.executive_sponsor ?? "—"}
                  </span>
                  <span className="metric ml-auto text-sm font-semibold text-foreground">
                    {p.percent_complete}%
                  </span>
                  <ProjectFindingsDialog
                    project={p}
                    findings={findings}
                    linkedFindingIds={links
                      .filter((l) => l.project_id === p.id)
                      .map((l) => l.finding_id)}
                    trigger={
                      <Button variant="outline" size="sm">
                        Linked findings (
                        {links.filter((l) => l.project_id === p.id).length})
                      </Button>
                    }
                  />
                  {can("manage_findings") && organization && facility ? (
                    <ImprovementProjectDialog
                      project={p}
                      organizationId={organization.id}
                      facilityId={facility.id}
                      trigger={
                        <Button variant="outline" size="sm">
                          <Pencil className="size-3.5" aria-hidden /> Manage
                        </Button>
                      }
                    />
                  ) : null}
                </div>

                <div className="h-2 w-full overflow-hidden rounded-sm bg-muted">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${p.percent_complete}%` }}
                  />
                </div>

                <dl className="grid gap-4 text-sm md:grid-cols-3">
                  <div>
                    <dt className="eyebrow">Baseline</dt>
                    <dd className="mt-0.5 text-muted-foreground">
                      {p.baseline_metric ?? "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="eyebrow">Target</dt>
                    <dd className="mt-0.5 text-muted-foreground">
                      {p.target_metric ?? "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="eyebrow">Financial impact</dt>
                    <dd className="metric mt-0.5 text-foreground">
                      {p.estimated_financial_impact
                        ? `$${Number(p.estimated_financial_impact).toLocaleString()}`
                        : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="eyebrow">Window</dt>
                    <dd className="metric mt-0.5 text-muted-foreground">
                      {formatDate(p.planned_start)} →{" "}
                      {formatDate(p.planned_completion)}
                    </dd>
                  </div>
                  <div className="md:col-span-2">
                    <dt className="eyebrow">Risks</dt>
                    <dd className="mt-0.5 text-muted-foreground">
                      {p.risks ?? "—"}
                    </dd>
                  </div>
                </dl>

                {p.results ? (
                  <p className="border-t border-border pt-4 text-sm text-muted-foreground">
                    <span className="font-semibold text-foreground/80">
                      Results:{" "}
                    </span>
                    {p.results}
                  </p>
                ) : null}
              </div>
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
}
