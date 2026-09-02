import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  PageHeader,
  Panel,
  EmptyState,
} from "@/components/ironiq/layout-primitives";
import { Tag } from "@/components/ironiq/badges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApp } from "@/context/app-context";
import {
  useArchiveSupplier,
  useCreateSupplier,
  useSuppliers,
  useUpdateSupplier,
  type Supplier,
} from "@/lib/suppliers-api";

export const Route = createFileRoute("/_authenticated/suppliers")({
  head: () => ({
    meta: [
      { title: "Suppliers — IronIQ" },
      {
        name: "description",
        content:
          "Supplier directory: contacts, lead time, and quality notes for the materials, tooling, and services this shop relies on.",
      },
    ],
  }),
  component: SuppliersPage,
});

interface SupplierDraft {
  name: string;
  category: string;
  primaryContactName: string;
  primaryContactEmail: string;
  primaryContactPhone: string;
  leadTimeDays: string;
  qualityNotes: string;
}

function emptyDraft(): SupplierDraft {
  return {
    name: "",
    category: "",
    primaryContactName: "",
    primaryContactEmail: "",
    primaryContactPhone: "",
    leadTimeDays: "",
    qualityNotes: "",
  };
}

function draftFromSupplier(s: Supplier): SupplierDraft {
  return {
    name: s.name,
    category: s.category ?? "",
    primaryContactName: s.primary_contact_name ?? "",
    primaryContactEmail: s.primary_contact_email ?? "",
    primaryContactPhone: s.primary_contact_phone ?? "",
    leadTimeDays: s.lead_time_days != null ? String(s.lead_time_days) : "",
    qualityNotes: s.quality_notes ?? "",
  };
}

function SuppliersPage() {
  const { organization, facility } = useApp();
  const suppliers = useSuppliers(organization?.id).data ?? [];
  const create = useCreateSupplier(organization?.id);
  const update = useUpdateSupplier(organization?.id);
  const archive = useArchiveSupplier(organization?.id);

  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<SupplierDraft>(emptyDraft());

  const set = <K extends keyof SupplierDraft>(
    key: K,
    value: SupplierDraft[K],
  ) => setDraft((d) => ({ ...d, [key]: value }));

  function submitPayload() {
    return {
      organizationId: organization?.id as string,
      facilityId: facility?.id,
      name: draft.name,
      category: draft.category || undefined,
      primaryContactName: draft.primaryContactName || undefined,
      primaryContactEmail: draft.primaryContactEmail || undefined,
      primaryContactPhone: draft.primaryContactPhone || undefined,
      leadTimeDays: draft.leadTimeDays ? Number(draft.leadTimeDays) : undefined,
      qualityNotes: draft.qualityNotes || undefined,
    };
  }

  function startEdit(s: Supplier) {
    setEditingId(s.id);
    setDraft(draftFromSupplier(s));
    setAdding(false);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        eyebrow="Shop"
        title="Suppliers"
        description="Contacts, lead time, and quality notes for the materials, tooling, and services this shop relies on. Not yet linked to the supplier fields already recorded on individual materials/tooling/consumables in Production Libraries — this is a standalone directory for now."
        actions={
          <Button
            variant="outline"
            onClick={() => {
              setAdding((v) => !v);
              setEditingId(null);
              setDraft(emptyDraft());
            }}
          >
            {adding ? "Cancel" : "Add supplier"}
          </Button>
        }
      />

      {adding ? (
        <Panel title="New supplier">
          <SupplierForm
            draft={draft}
            set={set}
            busy={create.isPending}
            onCancel={() => setAdding(false)}
            onSubmit={() =>
              create.mutate(submitPayload(), {
                onSuccess: () => {
                  setAdding(false);
                  setDraft(emptyDraft());
                },
              })
            }
          />
        </Panel>
      ) : null}

      {suppliers.length === 0 && !adding ? (
        <EmptyState message="No suppliers recorded yet for this organization." />
      ) : (
        <div className="space-y-3">
          {suppliers.map((s) =>
            editingId === s.id ? (
              <Panel key={s.id} title={`Edit ${s.name}`}>
                <SupplierForm
                  draft={draft}
                  set={set}
                  busy={update.isPending}
                  onCancel={() => setEditingId(null)}
                  onSubmit={() =>
                    update.mutate(
                      { ...submitPayload(), id: s.id },
                      { onSuccess: () => setEditingId(null) },
                    )
                  }
                />
              </Panel>
            ) : (
              <Panel key={s.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-foreground">
                        {s.name}
                      </p>
                      {s.category ? (
                        <Tag token="steel">{s.category}</Tag>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {[
                        s.primary_contact_name,
                        s.primary_contact_email,
                        s.primary_contact_phone,
                      ]
                        .filter(Boolean)
                        .join(" · ") || "No contact on file"}
                    </p>
                    {s.lead_time_days != null ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Lead time: {s.lead_time_days} day
                        {s.lead_time_days === 1 ? "" : "s"}
                      </p>
                    ) : null}
                    {s.quality_notes ? (
                      <p className="mt-2 text-xs text-muted-foreground">
                        {s.quality_notes}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => startEdit(s)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={archive.isPending}
                      onClick={() => archive.mutate(s.id)}
                    >
                      Archive
                    </Button>
                  </div>
                </div>
              </Panel>
            ),
          )}
        </div>
      )}
    </div>
  );
}

function SupplierForm({
  draft,
  set,
  busy,
  onCancel,
  onSubmit,
}: {
  draft: SupplierDraft;
  set: <K extends keyof SupplierDraft>(key: K, value: SupplierDraft[K]) => void;
  busy: boolean;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <Label>Name</Label>
        <Input
          value={draft.name}
          onChange={(e) => set("name", e.target.value)}
        />
      </div>
      <div>
        <Label>Category</Label>
        <Input
          value={draft.category}
          onChange={(e) => set("category", e.target.value)}
          placeholder="Material, tooling, consumable, service…"
        />
      </div>
      <div>
        <Label>Lead time (days)</Label>
        <Input
          type="number"
          min={0}
          value={draft.leadTimeDays}
          onChange={(e) => set("leadTimeDays", e.target.value)}
        />
      </div>
      <div>
        <Label>Contact name</Label>
        <Input
          value={draft.primaryContactName}
          onChange={(e) => set("primaryContactName", e.target.value)}
        />
      </div>
      <div>
        <Label>Contact email</Label>
        <Input
          type="email"
          value={draft.primaryContactEmail}
          onChange={(e) => set("primaryContactEmail", e.target.value)}
        />
      </div>
      <div className="sm:col-span-2">
        <Label>Contact phone</Label>
        <Input
          value={draft.primaryContactPhone}
          onChange={(e) => set("primaryContactPhone", e.target.value)}
        />
      </div>
      <div className="sm:col-span-2">
        <Label>Quality notes</Label>
        <Input
          value={draft.qualityNotes}
          onChange={(e) => set("qualityNotes", e.target.value)}
          placeholder="Certifications, on-time performance, past issues…"
        />
      </div>
      <div className="flex gap-2 sm:col-span-2">
        <Button onClick={onSubmit} disabled={busy || !draft.name.trim()}>
          {busy ? "Saving…" : "Save"}
        </Button>
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
