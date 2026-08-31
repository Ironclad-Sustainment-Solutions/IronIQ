import { useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import {
  PageHeader,
  Panel,
  EmptyState,
} from "@/components/ironiq/layout-primitives";
import { Tag } from "@/components/ironiq/badges";
import { Button } from "@/components/ui/button";
import { useApp } from "@/context/app-context";
import { EdgeSetupPanel } from "@/components/ironiq/edge-setup-panel";
import {
  ShopMachineForm,
  emptyMachineDraft,
} from "@/components/ironiq/shop-machine-form";
import {
  useCreateShopMachine,
  useDeleteShopMachine,
  useShopMachines,
} from "@/lib/shop-floor-api";
import {
  CONNECTION_LABELS,
  CONTROL_LABELS,
  PROTOCOL_LABELS,
} from "@/lib/shop-floor";

export const Route = createFileRoute("/_authenticated/machines/")({
  head: () => ({
    meta: [
      { title: "Machines — IronIQ" },
      {
        name: "description",
        content:
          "Facility machine master — asset ID, control, and connection status. Manual and CSV runs, or a live feed via IronIQ Edge.",
      },
      { property: "og:title", content: "Machines — IronIQ" },
      {
        property: "og:description",
        content:
          "Identify machines on this floor, connect a live feed or log runs by hand.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MachinesPage,
});

function MachinesPage() {
  const { organization, facility } = useApp();
  const machines = useShopMachines(organization?.id, facility?.id).data ?? [];
  const create = useCreateShopMachine(organization?.id, facility?.id);
  const remove = useDeleteShopMachine(organization?.id, facility?.id);
  const [adding, setAdding] = useState(false);

  if (!organization || !facility) {
    return (
      <div className="mx-auto max-w-5xl space-y-8">
        <PageHeader eyebrow="Machines" title="Machines" />
        <EmptyState message="Select an organization and facility first." />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <PageHeader
        eyebrow={facility.name}
        title="Machines"
        description="Start with 1–3 machines on this floor. Log cycles and runtime by hand or CSV, or connect a live feed with IronIQ Edge below — either way, nothing here silently assumes more than what's actually being reported."
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link to="/machines/program-map">Program → part map</Link>
            </Button>
            <Button variant="outline" onClick={() => setAdding((v) => !v)}>
              {adding ? "Cancel" : "Add machine"}
            </Button>
          </div>
        }
      />

      <EdgeSetupPanel facilityId={facility.id} />

      {adding ? (
        <Panel title="Add a machine">
          <ShopMachineForm
            initial={emptyMachineDraft()}
            submitLabel="Save machine"
            busy={create.isPending}
            onSubmit={(draft) =>
              create.mutate(draft, { onSuccess: () => setAdding(false) })
            }
            onCancel={() => setAdding(false)}
          />
        </Panel>
      ) : null}

      <Panel
        title="Machine master"
        subtitle={
          machines.length > 3
            ? `${machines.length} machines — this pilot is meant for 1–3`
            : `${machines.length} machine${machines.length === 1 ? "" : "s"}`
        }
      >
        {machines.length === 0 ? (
          <EmptyState message="No machines yet. Add 1–3 assets for this facility." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  {[
                    "Asset",
                    "Name",
                    "Make / model",
                    "Control",
                    "Protocol",
                    "Status",
                    "Location",
                    "",
                  ].map((h) => (
                    <th key={h} className="eyebrow py-2 pr-4">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {machines.map((m) => (
                  <tr key={m.id} className="border-b border-border/60">
                    <td className="py-2.5 pr-4">
                      <Link
                        to="/machines/$machineId"
                        params={{ machineId: m.id }}
                        className="font-medium text-primary hover:underline"
                      >
                        {m.asset_id}
                      </Link>
                    </td>
                    <td className="py-2.5 pr-4">{m.name}</td>
                    <td className="py-2.5 pr-4">
                      {m.make} {m.model}
                    </td>
                    <td className="py-2.5 pr-4">{CONTROL_LABELS[m.control]}</td>
                    <td className="py-2.5 pr-4">
                      {PROTOCOL_LABELS[m.protocol]}
                    </td>
                    <td className="py-2.5 pr-4">
                      <Tag
                        token={
                          m.connection_status === "not_connected"
                            ? "steel"
                            : "primary"
                        }
                      >
                        {CONNECTION_LABELS[m.connection_status]}
                      </Tag>
                    </td>
                    <td className="py-2.5 pr-4">{m.location || "—"}</td>
                    <td className="py-2.5 pr-0 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (confirm(`Remove ${m.asset_id} — ${m.name}?`)) {
                            remove.mutate(m.id);
                          }
                        }}
                      >
                        Remove
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
