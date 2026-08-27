import { useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import {
  PageHeader,
  Panel,
  EmptyState,
} from "@/components/ironiq/layout-primitives";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tag } from "@/components/ironiq/badges";
import {
  usePostProcessors,
  useProgrammerCapabilities,
  useToolingProfiles,
} from "@/lib/production-api";
import { COMPLEXITY_LABELS } from "@/lib/workflow";
import { useApp } from "@/context/app-context";
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

export const Route = createFileRoute("/_authenticated/production/libraries")({
  head: () => ({
    meta: [
      { title: "Machine & Tooling Libraries — IronIQ Production Flow" },
      {
        name: "description",
        content:
          "Approved machine profiles, post processors, tooling library and programmer capability matrix used by IronIQ production planning.",
      },
      { property: "og:title", content: "Machine & Tooling Libraries — IronIQ" },
      {
        property: "og:description",
        content:
          "Approved machines, controllers, post processors, tooling and programmer capacity.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Libraries,
});

function Libraries() {
  const { organization, facility } = useApp();
  const machines = useShopMachines(organization?.id, facility?.id).data ?? [];
  const create = useCreateShopMachine(organization?.id, facility?.id);
  const remove = useDeleteShopMachine(organization?.id, facility?.id);
  const [adding, setAdding] = useState(false);
  const { data: tools = [] } = useToolingProfiles();
  const { data: posts = [] } = usePostProcessors();
  const { data: capabilities = [] } = useProgrammerCapabilities();

  return (
    <>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Production Flow"
          title="Machine & tooling libraries"
          description="Approved machines, post processors, tooling and programmer capability used for intake screening and planning."
        />

        <Panel
          title="Machine profiles"
          subtitle="Facility machine master used for run events and the CNC change log."
          actions={
            organization && facility ? (
              <div className="flex gap-2">
                <Button asChild size="sm" variant="outline">
                  <Link to="/machines">Open /machines</Link>
                </Button>
                <Button size="sm" onClick={() => setAdding((v) => !v)}>
                  {adding ? "Cancel" : "Add machine"}
                </Button>
              </div>
            ) : null
          }
        >
          {!organization || !facility ? (
            <EmptyState message="Select an organization and facility to manage machines." />
          ) : (
            <div className="space-y-4">
              {adding ? (
                <ShopMachineForm
                  initial={emptyMachineDraft()}
                  submitLabel="Save machine"
                  busy={create.isPending}
                  onSubmit={(draft) =>
                    create.mutate(draft, { onSuccess: () => setAdding(false) })
                  }
                  onCancel={() => setAdding(false)}
                />
              ) : null}
              {machines.length === 0 ? (
                <EmptyState message="No machine profiles yet." />
              ) : (
                <Table
                  head={[
                    "Asset",
                    "Name",
                    "Make / model",
                    "Control",
                    "Protocol",
                    "Status",
                    "Location",
                    "",
                  ]}
                  rows={machines.map((m) => [
                    <Link
                      key={m.id}
                      to="/machines/$machineId"
                      params={{ machineId: m.id }}
                      className="font-medium text-primary hover:underline"
                    >
                      {m.asset_id}
                    </Link>,
                    m.name,
                    `${m.make} ${m.model}`,
                    CONTROL_LABELS[m.control],
                    PROTOCOL_LABELS[m.protocol],
                    <Tag
                      key={`${m.id}-status`}
                      token={
                        m.connection_status === "not_connected"
                          ? "steel"
                          : "primary"
                      }
                    >
                      {CONNECTION_LABELS[m.connection_status]}
                    </Tag>,
                    m.location || "—",
                    <Button
                      key={`${m.id}-remove`}
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        if (confirm(`Remove ${m.asset_id} — ${m.name}?`)) {
                          remove.mutate(m.id);
                        }
                      }}
                    >
                      Remove
                    </Button>,
                  ])}
                />
              )}
            </div>
          )}
        </Panel>

        <Panel title="Post processors">
          {posts.length === 0 ? (
            <EmptyState message="No post processors registered." />
          ) : (
            <Table
              head={[
                "Name",
                "Controller",
                "Machine family",
                "Version",
                "Approved",
              ]}
              rows={posts.map((p) => [
                p.name,
                p.controller,
                p.machine_family ?? "—",
                p.version,
                p.is_approved ? "Yes" : "No",
              ])}
            />
          )}
        </Panel>

        <Panel title="Tooling library">
          {tools.length === 0 ? (
            <EmptyState message="No tooling registered." />
          ) : (
            <Table
              head={[
                "Tool #",
                "Description",
                "Type",
                "Ø",
                "Flutes",
                "Stick-out",
                "Approved",
              ]}
              rows={tools.map((t) => [
                t.tool_number ?? "—",
                t.description,
                t.tool_type,
                t.diameter ?? "—",
                t.flute_count ?? "—",
                t.stick_out ?? "—",
                t.is_approved ? "Yes" : "No",
              ])}
            />
          )}
        </Panel>

        <Panel
          title="Programmer capability"
          subtitle="Drives auto-assignment: machine make, controller, complexity ceiling and active-job capacity."
        >
          {capabilities.length === 0 ? (
            <EmptyState message="No programmer capability records." />
          ) : (
            <Table
              head={[
                "Programmer",
                "Machine makes",
                "Controllers",
                "Max complexity",
                "Max active jobs",
                "Available",
              ]}
              rows={capabilities.map((c) => [
                c.programmer_id.slice(0, 8),
                c.machine_makes.join(", ") || "—",
                c.controllers.join(", ") || "—",
                COMPLEXITY_LABELS[c.max_complexity],
                String(c.max_active_jobs),
                c.available ? "Yes" : "No",
              ])}
            />
          )}
        </Panel>
      </div>
    </>
  );
}

function Table({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left">
            {head.map((h) => (
              <th key={h} className="eyebrow py-2 pr-4">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-border/60">
              {row.map((cell, j) => (
                <td key={j} className="py-2.5 pr-4">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
