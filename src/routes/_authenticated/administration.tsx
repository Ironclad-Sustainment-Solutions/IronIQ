import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Panel, DefinitionList, EmptyState } from "@/components/ironiq/layout-primitives";
import { Tag } from "@/components/ironiq/badges";
import { useApp } from "@/context/app-context";
import { useAuditLog } from "@/lib/api";
import { ROLE_LABELS } from "@/lib/domain";

export const Route = createFileRoute("/_authenticated/administration")({
  head: () => ({
    meta: [
      { title: "Administration — IronIQ" },
      {
        name: "description",
        content: "Account profile, assigned roles and capabilities, and the immutable platform audit trail.",
      },
      { property: "og:title", content: "Administration — IronIQ" },
      { property: "og:description", content: "Roles, permissions and audit trail." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdministrationPage,
});

function AdministrationPage() {
  const { profile, roles, primaryRole } = useApp();
  const log = useAuditLog().data ?? [];

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <PageHeader
        eyebrow="Settings"
        title="Administration"
        description="Your account, the roles that determine what you can score, finalize and reopen, and the platform audit trail."
      />

      <Panel title="Your account">
        <DefinitionList
          items={[
            { label: "Name", value: profile?.full_name ?? "—" },
            { label: "Email", value: profile?.email ?? "—" },
            { label: "Job title", value: profile?.job_title ?? "—" },
            { label: "Primary role", value: ROLE_LABELS[primaryRole] },
          ]}
        />
        <div className="mt-5 flex flex-wrap gap-2 border-t border-border pt-5">
          {roles.map((r) => (
            <Tag key={r} token="primary">
              {ROLE_LABELS[r]}
            </Tag>
          ))}
        </div>
      </Panel>

      <Panel title="Audit trail" subtitle="Most recent 100 recorded platform events">
        {log.length === 0 ? (
          <EmptyState message="No audit events recorded yet." />
        ) : (
          <ul className="divide-y divide-border">
            {log.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0 text-sm">
                <span className="metric text-xs text-muted-foreground">
                  {new Date(e.created_at).toLocaleString()}
                </span>
                <span className="font-medium text-foreground">{e.action}</span>
                <span className="text-xs text-muted-foreground">
                  {e.entity_type} · {e.actor_name ?? "system"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
