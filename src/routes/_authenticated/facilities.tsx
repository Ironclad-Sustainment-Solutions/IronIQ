import { createFileRoute, Link } from "@tanstack/react-router";
import {
  PageHeader,
  Panel,
  EmptyState,
} from "@/components/ironiq/layout-primitives";
import { ReadinessBadge, Tag } from "@/components/ironiq/badges";
import { useApp } from "@/context/app-context";
import { useFacilities } from "@/lib/api";
import { formatScore, readinessLevelFor } from "@/lib/scoring";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { FacilityDialog } from "@/components/ironiq/entity-dialogs";
import { useArchiveFacility } from "@/lib/mutations";
import { useDeleteFacility } from "@/lib/admin-org-delete-api";

export const Route = createFileRoute("/_authenticated/facilities")({
  head: () => ({
    meta: [
      { title: "Facilities — IronIQ" },
      {
        name: "description",
        content:
          "Facility profiles including processes, machine and headcount, certifications and current manufacturing readiness score.",
      },
      { property: "og:title", content: "Facilities — IronIQ" },
      {
        property: "og:description",
        content: "Facility profiles and current readiness scores.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FacilitiesPage,
});

function FacilitiesPage() {
  const { organization, setFacilityId, can, roles } = useApp();
  const facilities = useFacilities(organization?.id).data ?? [];
  const archive = useArchiveFacility();
  const deleteFac = useDeleteFacility();

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <PageHeader
        eyebrow={organization?.name ?? "Portfolio"}
        title="Facilities"
        description="Plant-level profiles used to scope assessments and interpret readiness results."
        actions={
          can("manage_organizations") && organization ? (
            <FacilityDialog
              organizationId={organization.id}
              trigger={<Button variant="outline">Add facility</Button>}
            />
          ) : undefined
        }
      />

      {facilities.length === 0 ? (
        <EmptyState message="No facilities in this organization yet." />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {facilities.map((f) => {
            const score =
              f.current_readiness_score === null
                ? null
                : Number(f.current_readiness_score);
            return (
              <Panel
                key={f.id}
                title={f.name}
                subtitle={f.address ?? undefined}
              >
                <div className="space-y-5">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="metric text-3xl font-semibold text-foreground">
                      {formatScore(score)}
                    </span>
                    <ReadinessBadge
                      level={score === null ? null : readinessLevelFor(score)}
                    />
                    <span className="text-xs text-muted-foreground">
                      Last assessed {f.last_assessment_date ?? "never"}
                    </span>
                  </div>

                  <dl className="grid gap-4 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="eyebrow">Primary products</dt>
                      <dd className="mt-0.5 text-foreground">
                        {f.primary_products ?? "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="eyebrow">Primary processes</dt>
                      <dd className="mt-0.5 text-foreground">
                        {f.primary_processes ?? "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="eyebrow">Machines / Employees / Shifts</dt>
                      <dd className="metric mt-0.5 text-foreground">
                        {f.machine_count ?? "—"} / {f.employee_count ?? "—"} /{" "}
                        {f.operating_shifts ?? "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="eyebrow">Site contact</dt>
                      <dd className="mt-0.5 text-foreground">
                        {f.primary_contact_name ?? "—"}
                      </dd>
                      <dd className="text-xs text-muted-foreground">
                        {f.primary_contact_email}
                      </dd>
                    </div>
                  </dl>

                  {f.certifications?.length ? (
                    <div className="flex flex-wrap gap-2">
                      {f.certifications.map((c) => (
                        <Tag key={c} token="primary">
                          {c}
                        </Tag>
                      ))}
                    </div>
                  ) : null}

                  <div className="flex gap-2 border-t border-border pt-4">
                    <Button
                      size="sm"
                      asChild
                      onClick={() => setFacilityId(f.id)}
                    >
                      <Link to="/dashboard">Open dashboard</Link>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      asChild
                      onClick={() => setFacilityId(f.id)}
                    >
                      <Link to="/assessments">Assessments</Link>
                    </Button>
                    {can("manage_organizations") ? (
                      <>
                        <FacilityDialog
                          facility={f}
                          organizationId={f.organization_id}
                          trigger={
                            <Button size="sm" variant="outline">
                              Edit
                            </Button>
                          }
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={archive.isPending}
                          onClick={() =>
                            archive.mutate({
                              id: f.id,
                              archived: f.status !== "archived",
                            })
                          }
                        >
                          {f.status === "archived" ? "Restore" : "Archive"}
                        </Button>
                        {roles.includes("ironiq_admin") ? (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-critical hover:text-critical"
                              >
                                Delete
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>
                                  Permanently delete {f.name}?
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  This cannot be undone. Every assessment,
                                  finding, corrective action, improvement
                                  project, CAD job, and CNC log entry at this
                                  facility will be permanently deleted along
                                  with it. Archiving instead of deleting keeps
                                  this data recoverable.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  className="bg-critical text-white hover:bg-critical/90"
                                  onClick={() => deleteFac.mutate(f.id)}
                                >
                                  Permanently delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        ) : null}
                      </>
                    ) : null}
                  </div>
                </div>
              </Panel>
            );
          })}
        </div>
      )}
    </div>
  );
}
