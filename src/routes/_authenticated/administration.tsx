import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  PageHeader,
  Panel,
  DefinitionList,
  EmptyState,
} from "@/components/ironiq/layout-primitives";
import { Tag } from "@/components/ironiq/badges";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useApp } from "@/context/app-context";
import { useAuditLog, useOrganizations } from "@/lib/api";
import { ROLE_LABELS, type AppRole } from "@/lib/domain";
import {
  useAllUsers,
  useApproveUser,
  useRejectUser,
  useSetUserRole,
  useAddOrgMembership,
  useRemoveOrgMembership,
  type AdminUserRow,
} from "@/lib/admin-users-api";
import {
  usePendingPatterns,
  useApprovePattern,
  useRejectPattern,
} from "@/lib/ask-ironiq-api";
import {
  useProductRestrictions,
  useSetProductRestriction,
  type RestrictableProduct,
} from "@/lib/product-access-api";

export const Route = createFileRoute("/_authenticated/administration")({
  head: () => ({
    meta: [
      { title: "Administration — IronIQ" },
      {
        name: "description",
        content:
          "Account profile, assigned roles and capabilities, and the immutable platform audit trail.",
      },
      { property: "og:title", content: "Administration — IronIQ" },
      {
        property: "og:description",
        content: "Roles, permissions and audit trail.",
      },
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

      <Panel
        title="Audit trail"
        subtitle="Most recent 100 recorded platform events"
      >
        {log.length === 0 ? (
          <EmptyState message="No audit events recorded yet." />
        ) : (
          <ul className="divide-y divide-border">
            {log.map((e) => (
              <li
                key={e.id}
                className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0 text-sm"
              >
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

      {roles.includes("ironiq_admin") ? <UserManagement /> : null}
      {roles.includes("ironiq_admin") ? <ProductAccessManagement /> : null}
      {roles.includes("ironiq_admin") || roles.includes("consultant") ? (
        <PatternReviewQueue />
      ) : null}
    </div>
  );
}

const PRODUCT_LABELS: Record<RestrictableProduct, string> = {
  assessment: "Assessment",
  cad: "CAD Conversion",
  cnc: "CNC Coding",
};

function ProductAccessManagement() {
  const organizations = useOrganizations().data ?? [];
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(
    organizations[0]?.id ?? null,
  );
  const restrictions = useProductRestrictions(selectedOrgId);
  const setRestriction = useSetProductRestriction(selectedOrgId);

  return (
    <Panel
      title="Product access"
      subtitle="Restrict specific organizations from specific products — open by default, matching how every org behaves today, until restricted here."
    >
      <div className="space-y-4">
        <Select
          value={selectedOrgId ?? undefined}
          onValueChange={setSelectedOrgId}
        >
          <SelectTrigger className="max-w-sm">
            <SelectValue placeholder="Select an organization" />
          </SelectTrigger>
          <SelectContent>
            {organizations.map((org) => (
              <SelectItem key={org.id} value={org.id}>
                {org.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {selectedOrgId ? (
          <div className="flex flex-wrap gap-3">
            {(Object.keys(PRODUCT_LABELS) as RestrictableProduct[]).map(
              (product) => {
                const isRestricted =
                  restrictions.data?.includes(product) ?? false;
                return (
                  <div
                    key={product}
                    className="flex items-center justify-between gap-4 rounded-md border border-border px-4 py-3"
                  >
                    <span className="text-sm text-foreground">
                      {PRODUCT_LABELS[product]}
                    </span>
                    <Button
                      size="sm"
                      variant={isRestricted ? "outline" : "ghost"}
                      disabled={
                        setRestriction.isPending || restrictions.isLoading
                      }
                      onClick={() =>
                        setRestriction.mutate({
                          product,
                          restricted: !isRestricted,
                        })
                      }
                    >
                      {isRestricted
                        ? "Restricted — click to allow"
                        : "Allowed — click to restrict"}
                    </Button>
                  </div>
                );
              },
            )}
          </div>
        ) : (
          <EmptyState message="No organizations yet." />
        )}
      </div>
    </Panel>
  );
}

function PatternReviewQueue() {
  const pending = usePendingPatterns().data ?? [];
  const approve = useApprovePattern();
  const reject = useRejectPattern();

  return (
    <Panel
      title="Intelligence Layer — pending patterns"
      subtitle="Anonymized precedent drafted from closed findings, corrective actions and projects — nothing here is visible to any other organization until approved."
    >
      {pending.length === 0 ? (
        <EmptyState message="No patterns waiting for review." />
      ) : (
        <ul className="divide-y divide-border">
          {pending.map((p) => (
            <li key={p.id} className="space-y-3 py-4 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-center gap-2">
                <Tag token="steel">
                  {p.category_label ?? "unspecified industry"}
                </Tag>
                <span className="text-xs text-muted-foreground">
                  drafted {new Date(p.created_at).toLocaleString()}
                </span>
              </div>
              <div className="grid gap-2 text-sm md:grid-cols-3">
                <div>
                  <p className="eyebrow">Problem</p>
                  <p className="mt-0.5 text-foreground">{p.pattern_summary}</p>
                </div>
                <div>
                  <p className="eyebrow">Resolution</p>
                  <p className="mt-0.5 text-muted-foreground">
                    {p.pattern_resolution ?? "—"}
                  </p>
                </div>
                <div>
                  <p className="eyebrow">Outcome</p>
                  <p className="mt-0.5 text-muted-foreground">
                    {p.pattern_outcome ?? "—"}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => approve.mutate(p.id)}
                  disabled={approve.isPending}
                >
                  Approve &amp; share
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => reject.mutate({ id: p.id })}
                  disabled={reject.isPending}
                >
                  Reject
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

const ROLE_OPTIONS: AppRole[] = [
  "ironiq_admin",
  "consultant",
  "customer_admin",
  "facility_manager",
  "assessor",
  "executive",
];

function UserManagement() {
  const users = useAllUsers().data ?? [];
  const organizations = useOrganizations().data ?? [];
  const approve = useApproveUser();
  const reject = useRejectUser();
  const setRole = useSetUserRole();
  const addOrg = useAddOrgMembership();
  const removeOrg = useRemoveOrgMembership();

  const pending = users.filter((u) => !u.approved);
  const active = users.filter((u) => u.approved);

  return (
    <>
      <Panel
        title="Pending approvals"
        subtitle="New accounts can't sign in until approved here — see db/schema_additions_user_approval.sql"
      >
        {pending.length === 0 ? (
          <EmptyState message="No accounts waiting for approval." />
        ) : (
          <ul className="divide-y divide-border">
            {pending.map((u) => (
              <li
                key={u.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {u.full_name ?? u.email}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {u.email} · requested{" "}
                    {new Date(u.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => approve.mutate(u.id)}
                    disabled={approve.isPending}
                  >
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      if (
                        confirm(
                          `Reject and delete the account for ${u.email}? This cannot be undone.`,
                        )
                      ) {
                        reject.mutate(u.id);
                      }
                    }}
                    disabled={reject.isPending}
                  >
                    Reject
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel
        title="All users"
        subtitle={`${active.length} approved account(s)`}
      >
        {active.length === 0 ? (
          <EmptyState message="No approved accounts yet." />
        ) : (
          <div className="space-y-4">
            {active.map((u) => (
              <UserRow
                key={u.id}
                user={u}
                organizations={organizations}
                onSetRole={(role) => setRole.mutate({ userId: u.id, role })}
                onAddOrg={(organizationId, role) =>
                  addOrg.mutate({ userId: u.id, organizationId, role })
                }
                onRemoveOrg={(membershipId) => removeOrg.mutate(membershipId)}
              />
            ))}
          </div>
        )}
      </Panel>
    </>
  );
}

function UserRow({
  user,
  organizations,
  onSetRole,
  onAddOrg,
  onRemoveOrg,
}: {
  user: AdminUserRow;
  organizations: { id: string; name: string }[];
  onSetRole: (role: AppRole) => void;
  onAddOrg: (organizationId: string, role: AppRole) => void;
  onRemoveOrg: (membershipId: string) => void;
}) {
  const [orgToAdd, setOrgToAdd] = useState("");
  const [roleForOrg, setRoleForOrg] = useState<AppRole>("executive");
  const currentRole = user.roles[0] ?? "executive";

  return (
    <div className="rounded-md border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-foreground">
            {user.full_name ?? user.email}
          </p>
          <p className="text-xs text-muted-foreground">{user.email}</p>
        </div>
        <Select
          value={currentRole}
          onValueChange={(v) => onSetRole(v as AppRole)}
        >
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ROLE_OPTIONS.map((r) => (
              <SelectItem key={r} value={r}>
                {ROLE_LABELS[r]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
        {user.organizations.length === 0 ? (
          <span className="text-xs text-muted-foreground">
            Not attached to any organization yet.
          </span>
        ) : (
          user.organizations.map((m) => (
            <Tag key={m.membership_id} token="steel">
              {m.organization_name} · {ROLE_LABELS[m.role]}
              <button
                type="button"
                onClick={() => onRemoveOrg(m.membership_id)}
                className="ml-1.5 text-muted-foreground hover:text-foreground"
                aria-label={`Remove ${user.email} from ${m.organization_name}`}
              >
                ×
              </button>
            </Tag>
          ))
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Select value={orgToAdd} onValueChange={setOrgToAdd}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Add to organization…" />
          </SelectTrigger>
          <SelectContent>
            {organizations.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                {o.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={roleForOrg}
          onValueChange={(v) => setRoleForOrg(v as AppRole)}
        >
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ROLE_OPTIONS.map((r) => (
              <SelectItem key={r} value={r}>
                {ROLE_LABELS[r]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          variant="outline"
          disabled={!orgToAdd}
          onClick={() => {
            onAddOrg(orgToAdd, roleForOrg);
            setOrgToAdd("");
          }}
        >
          Attach
        </Button>
      </div>
    </div>
  );
}
