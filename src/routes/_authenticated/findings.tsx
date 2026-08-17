import { createFileRoute } from "@tanstack/react-router";
import { Pencil } from "lucide-react";
import {
  PageHeader,
  Panel,
  EmptyState,
} from "@/components/ironiq/layout-primitives";
import { SeverityBadge, FindingStatusBadge } from "@/components/ironiq/badges";
import { useApp } from "@/context/app-context";
import { useCorrectiveActions, useFindings } from "@/lib/api";
import { SEVERITY_ORDER } from "@/lib/domain";
import {
  FindingDialog,
  CorrectiveActionDialog,
} from "@/components/ironiq/entity-dialogs";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/findings")({
  head: () => ({
    meta: [
      { title: "Findings & Corrective Actions — IronIQ" },
      {
        name: "description",
        content:
          "Severity-ranked readiness findings with business impact, root cause, recommended action, owner, due date and verification status.",
      },
      {
        property: "og:title",
        content: "Findings & Corrective Actions — IronIQ",
      },
      {
        property: "og:description",
        content: "Track and close manufacturing readiness findings.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FindingsPage,
});

function FindingsPage() {
  const { facility, can } = useApp();
  const findings = useFindings(facility?.id).data ?? [];
  const actions = useCorrectiveActions(facility?.id).data ?? [];

  const sorted = [...findings].sort(
    (a, b) =>
      SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity),
  );

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <PageHeader
        eyebrow={facility?.name ?? "Facility"}
        title="Findings"
        description="Findings are generated automatically when a critical control scores 0–1 or a standard question scores 0–2, then managed through to verified closure."
      />

      {sorted.length === 0 ? (
        <EmptyState message="No findings recorded for this facility." />
      ) : (
        <div className="space-y-4">
          {sorted.map((f) => {
            const related = actions.filter((a) => a.finding_id === f.id);
            return (
              <Panel key={f.id}>
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <SeverityBadge severity={f.severity} />
                    <FindingStatusBadge status={f.status} />
                    <span className="metric text-xs text-muted-foreground">
                      {f.finding_code}
                    </span>
                    {f.category_name ? (
                      <span className="text-xs text-muted-foreground">
                        · {f.category_name}
                      </span>
                    ) : null}
                    {can("manage_findings") ? (
                      <FindingDialog
                        finding={f}
                        trigger={
                          <Button
                            variant="outline"
                            size="sm"
                            className="ml-auto"
                          >
                            <Pencil className="size-3.5" aria-hidden /> Manage
                          </Button>
                        }
                      />
                    ) : null}
                  </div>

                  <p className="text-sm font-medium text-foreground">
                    {f.description}
                  </p>

                  <dl className="grid gap-4 text-sm md:grid-cols-2">
                    <div>
                      <dt className="eyebrow">Business impact</dt>
                      <dd className="mt-0.5 text-muted-foreground">
                        {f.business_impact ?? "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="eyebrow">Root cause</dt>
                      <dd className="mt-0.5 text-muted-foreground">
                        {f.root_cause ?? "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="eyebrow">Recommended action</dt>
                      <dd className="mt-0.5 text-muted-foreground">
                        {f.recommended_action ?? "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="eyebrow">Owner / target</dt>
                      <dd className="mt-0.5 text-muted-foreground">
                        {f.assigned_owner ?? "Unassigned"} ·{" "}
                        {f.target_date ?? "no date"}
                      </dd>
                    </div>
                  </dl>

                  {related.length > 0 || can("manage_findings") ? (
                    <div className="border-t border-border pt-4">
                      <div className="flex items-center justify-between">
                        <p className="eyebrow">Corrective actions</p>
                        {can("manage_findings") && facility ? (
                          <CorrectiveActionDialog
                            findingId={f.id}
                            facilityId={facility.id}
                            trigger={
                              <Button variant="ghost" size="sm">
                                + Add corrective action
                              </Button>
                            }
                          />
                        ) : null}
                      </div>
                      {related.length > 0 ? (
                        <ul className="mt-2 space-y-2">
                          {related.map((a) => (
                            <li
                              key={a.id}
                              className="flex flex-wrap items-center gap-3 text-sm"
                            >
                              <FindingStatusBadge status={a.status} />
                              <span className="min-w-0 flex-1 text-foreground">
                                {a.action_description}
                              </span>
                              <span className="metric text-xs text-muted-foreground">
                                {a.owner ?? "—"} ·{" "}
                                {a.completed_date ?? a.target_date ?? "—"}
                              </span>
                              {can("manage_findings") && facility ? (
                                <CorrectiveActionDialog
                                  action={a}
                                  findingId={f.id}
                                  facilityId={facility.id}
                                  trigger={
                                    <Button variant="outline" size="sm">
                                      <Pencil
                                        className="size-3.5"
                                        aria-hidden
                                      />{" "}
                                      Manage
                                    </Button>
                                  }
                                />
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  ) : null}

                  {f.closure_evidence ? (
                    <p className="border-t border-border pt-4 text-xs text-muted-foreground">
                      <span className="font-semibold text-foreground/80">
                        Closure evidence:{" "}
                      </span>
                      {f.closure_evidence} — verified by {f.verified_by ?? "—"}{" "}
                      on {f.verification_date ?? "—"}
                    </p>
                  ) : null}
                </div>
              </Panel>
            );
          })}
        </div>
      )}
    </div>
  );
}
