import { createFileRoute, Link } from "@tanstack/react-router";
import { Building2 } from "lucide-react";
import { PageHeader, Panel, EmptyState } from "@/components/ironiq/layout-primitives";
import { Tag } from "@/components/ironiq/badges";
import { useApp } from "@/context/app-context";
import { useFacilities, useOrganizations } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { OrganizationDialog } from "@/components/ironiq/entity-dialogs";
import { useArchiveOrganization } from "@/lib/mutations";

export const Route = createFileRoute("/_authenticated/organizations")({
  head: () => ({
    meta: [
      { title: "Organizations — IronIQ" },
      {
        name: "description",
        content: "Manage client organizations, contacts and the facilities enrolled in the readiness programme.",
      },
      { property: "og:title", content: "Organizations — IronIQ" },
      { property: "og:description", content: "Client organizations enrolled in the IronIQ readiness programme." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: OrganizationsPage,
});

function OrganizationsPage() {
  const organizations = useOrganizations().data ?? [];
  const facilities = useFacilities().data ?? [];
  const { setOrganizationId, can } = useApp();
  const archive = useArchiveOrganization();

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <PageHeader
        eyebrow="Client portfolio"
        title="Organizations"
        description="Every organization enrolled in the IronIQ manufacturing readiness programme, with its facility footprint and primary contact."
        actions={
          can("manage_organizations") ? (
            <OrganizationDialog trigger={<Button variant="outline">New organization</Button>} />
          ) : undefined
        }
      />

      {organizations.length === 0 ? (
        <EmptyState message="No organizations are visible to your account." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {organizations.map((org) => {
            const orgFacilities = facilities.filter((f) => f.organization_id === org.id);
            return (
              <Panel key={org.id} title={org.name} subtitle={org.industry ?? undefined}>
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Tag token={org.status === "active" ? "success" : "steel"}>{org.status}</Tag>
                    <Tag token="steel">
                      {orgFacilities.length} facilit{orgFacilities.length === 1 ? "y" : "ies"}
                    </Tag>
                  </div>
                  <dl className="grid gap-3 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="eyebrow">Headquarters</dt>
                      <dd className="mt-0.5 text-foreground">{org.headquarters ?? "—"}</dd>
                    </div>
                    <div>
                      <dt className="eyebrow">Primary contact</dt>
                      <dd className="mt-0.5 text-foreground">{org.primary_contact_name ?? "—"}</dd>
                      <dd className="text-xs text-muted-foreground">{org.primary_contact_email}</dd>
                    </div>
                  </dl>

                  <ul className="space-y-2 border-t border-border pt-4">
                    {orgFacilities.map((f) => (
                      <li key={f.id} className="flex items-center justify-between gap-3">
                        <span className="flex min-w-0 items-center gap-2 text-sm text-foreground">
                          <Building2 className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                          <span className="truncate">{f.name}</span>
                        </span>
                        <span className="metric shrink-0 text-sm text-muted-foreground">
                          {f.current_readiness_score ?? "—"}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      asChild
                      onClick={() => setOrganizationId(org.id)}
                    >
                      <Link to="/facilities">View facilities</Link>
                    </Button>
                    {can("manage_organizations") ? (
                      <>
                        <OrganizationDialog
                          organization={org}
                          trigger={
                            <Button variant="outline" size="sm">
                              Edit
                            </Button>
                          }
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={archive.isPending}
                          onClick={() =>
                            archive.mutate({
                              id: org.id,
                              archived: org.status !== "archived",
                            })
                          }
                        >
                          {org.status === "archived" ? "Restore" : "Archive"}
                        </Button>
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
