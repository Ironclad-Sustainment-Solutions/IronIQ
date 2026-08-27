import { createFileRoute } from "@tanstack/react-router";
import {
  PageHeader,
  Panel,
  EmptyState,
} from "@/components/ironiq/layout-primitives";
import { Badge } from "@/components/ui/badge";
import {
  useMachineProfiles,
  usePostProcessors,
  useProgrammerCapabilities,
  useToolingProfiles,
} from "@/lib/production-api";
import { COMPLEXITY_LABELS } from "@/lib/workflow";

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
  const { data: machines = [] } = useMachineProfiles();
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

        <Panel title="Machine profiles">
          {machines.length === 0 ? (
            <EmptyState message="No machine profiles yet." />
          ) : (
            <Table
              head={[
                "Machine",
                "Controller",
                "Axes",
                "Travel X/Y/Z",
                "Post processors",
                "Status",
              ]}
              rows={machines.map((m) => [
                `${m.make} ${m.model}`,
                m.controller,
                String(m.axis_count),
                [m.travel_x, m.travel_y, m.travel_z]
                  .map((v) => v ?? "—")
                  .join(" / "),
                m.post_processors.join(", ") || "—",
                m.is_supported ? (
                  <Badge variant="outline">Supported</Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="border-destructive/50 text-destructive"
                  >
                    Unsupported
                  </Badge>
                ),
              ])}
            />
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
