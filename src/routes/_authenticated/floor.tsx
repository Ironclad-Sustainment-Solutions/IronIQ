import { useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import {
  EmptyState,
  PageHeader,
  Panel,
} from "@/components/ironiq/layout-primitives";
import { Tag } from "@/components/ironiq/badges";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useApp } from "@/context/app-context";
import { useFloorView } from "@/lib/machine-events-api";
import { EdgeSetupPanel } from "@/components/ironiq/edge-setup-panel";
import {
  formatFloorHours,
  type FloorMachineRow,
  type FloorState,
  type FloorTimelineSegment,
} from "@/lib/machine-events";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/floor")({
  head: () => ({
    meta: [
      { title: "Floor — IronIQ" },
      {
        name: "description",
        content:
          "Shop-floor status from ingested machine events: running, idle, or down, with today's cycles and a shift timeline.",
      },
      { property: "og:title", content: "Floor — IronIQ" },
      {
        property: "og:description",
        content:
          "One row per machine. Color comes from the latest ingested event, not a live CNC connection.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FloorPage,
});

const STATE_TAG: Record<FloorState, "success" | "medium" | "critical"> = {
  RUNNING: "success",
  IDLE: "medium",
  DOWN: "critical",
};

const STATE_BAR: Record<FloorState, string> = {
  RUNNING: "bg-success",
  IDLE: "bg-medium",
  DOWN: "bg-critical",
};

function stateLabel(row: FloorMachineRow): string {
  if (!row.connected) return "Not connected";
  return row.state ?? "No state";
}

function formatClock(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function FloorPage() {
  const { organization, facility } = useApp();
  const floor = useFloorView(organization?.id, facility?.id);
  const [selected, setSelected] = useState<FloorMachineRow | null>(null);

  if (!organization || !facility) {
    return (
      <div className="mx-auto max-w-5xl space-y-8">
        <PageHeader eyebrow="Machines" title="Floor" />
        <EmptyState message="Select an organization and facility first." />
      </div>
    );
  }

  const view = floor.data;
  const rows = view?.rows ?? [];

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <PageHeader
        eyebrow={facility.name}
        title="Floor"
        description="One row per machine on this floor. Color is the latest ingested non-heartbeat event (RUNNING, IDLE, DOWN). Cycles today are cycle_end events. Run and idle hours come from today's event timeline. Floor reads events; it does not talk to a CNC."
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link to="/machines">Machine master</Link>
            </Button>
            <Button
              variant="outline"
              onClick={() => void floor.refetch()}
              disabled={floor.isFetching}
            >
              {floor.isFetching ? "Refreshing…" : "Refresh"}
            </Button>
          </div>
        }
      />

      {floor.isError ? (
        <EmptyState
          message={
            floor.error instanceof Error
              ? floor.error.message
              : "Could not load the floor."
          }
        />
      ) : null}

      <EdgeSetupPanel facilityId={facility.id} />

      <Panel
        title="Machines"
        subtitle={
          floor.isLoading
            ? "Loading…"
            : `${rows.length} machine${rows.length === 1 ? "" : "s"} · today`
        }
      >
        {floor.isLoading ? (
          <EmptyState message="Loading…" />
        ) : rows.length === 0 ? (
          <EmptyState message="No machines yet. Add them on the Machines page. Floor will not invent a live connection." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  {[
                    "",
                    "Machine",
                    "State",
                    "Part / program",
                    "Cycles today",
                    "Run hours",
                    "Idle hours",
                  ].map((h) => (
                    <th key={h || "color"} className="eyebrow py-2 pr-4">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.machineId}
                    className="cursor-pointer border-b border-border/60 hover:bg-muted/20"
                    onClick={() => setSelected(row)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelected(row);
                      }
                    }}
                    tabIndex={0}
                    role="button"
                    aria-label={`${row.assetId} shift timeline`}
                  >
                    <td className="w-3 py-2.5 pr-3">
                      <span
                        className={cn(
                          "block h-8 w-1.5 rounded-sm",
                          row.state ? STATE_BAR[row.state] : "bg-muted",
                        )}
                        aria-hidden
                      />
                    </td>
                    <td className="py-2.5 pr-4">
                      <span className="font-medium text-foreground">
                        {row.assetId}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {row.name}
                        {row.location ? ` · ${row.location}` : ""}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4">
                      {row.state ? (
                        <Tag token={STATE_TAG[row.state]}>{row.state}</Tag>
                      ) : (
                        <Tag token="steel">{stateLabel(row)}</Tag>
                      )}
                    </td>
                    <td className="py-2.5 pr-4">
                      {row.currentPartOrProgram ?? "—"}
                    </td>
                    <td className="py-2.5 pr-4">
                      {row.connected ? row.cyclesToday : "—"}
                    </td>
                    <td className="py-2.5 pr-4">
                      {row.connected ? formatFloorHours(row.runHours) : "—"}
                    </td>
                    <td className="py-2.5 pr-4">
                      {row.connected ? formatFloorHours(row.idleHours) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <ShiftTimelineSheet
        row={selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      />
    </div>
  );
}

function ShiftTimelineSheet({
  row,
  onOpenChange,
}: {
  row: FloorMachineRow | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={Boolean(row)} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        {row ? (
          <>
            <SheetHeader className="text-left">
              <p className="eyebrow">{row.assetId}</p>
              <SheetTitle>Shift timeline</SheetTitle>
              <SheetDescription>
                Today, from ingested events. Empty means not connected — this
                view does not talk to a CNC.
              </SheetDescription>
            </SheetHeader>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              {row.state ? (
                <Tag token={STATE_TAG[row.state]}>{row.state}</Tag>
              ) : (
                <Tag token="steel">{stateLabel(row)}</Tag>
              )}
              <span className="text-sm text-muted-foreground">
                {row.currentPartOrProgram ?? "No part or program"}
              </span>
            </div>

            {!row.connected || row.timeline.length === 0 ? (
              <div className="mt-6">
                <EmptyState message="No events for this shift — not connected." />
              </div>
            ) : (
              <div className="mt-6 space-y-6">
                <TimelineBar segments={row.timeline} />
                <ol className="space-y-2">
                  {row.timeline.map((seg) => (
                    <li
                      key={`${seg.start}-${seg.end}-${seg.state ?? "none"}`}
                      className="flex items-start gap-3 text-sm"
                    >
                      <span
                        className={cn(
                          "mt-1 h-3 w-3 shrink-0 rounded-sm",
                          seg.state ? STATE_BAR[seg.state] : "bg-muted",
                        )}
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1">
                        <span className="font-medium text-foreground">
                          {seg.state ?? "No state"}
                        </span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {formatClock(seg.start)} – {formatClock(seg.end)}
                          {seg.partOrProgram ? ` · ${seg.partOrProgram}` : ""}
                        </span>
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function TimelineBar({ segments }: { segments: FloorTimelineSegment[] }) {
  const total = segments.reduce(
    (sum, seg) =>
      sum +
      Math.max(0, new Date(seg.end).getTime() - new Date(seg.start).getTime()),
    0,
  );
  if (total <= 0) return null;
  return (
    <div
      className="flex h-8 overflow-hidden rounded-sm border border-border"
      role="img"
      aria-label="Shift state timeline"
    >
      {segments.map((seg) => {
        const ms = Math.max(
          0,
          new Date(seg.end).getTime() - new Date(seg.start).getTime(),
        );
        return (
          <div
            key={`${seg.start}-${seg.end}`}
            className={cn(seg.state ? STATE_BAR[seg.state] : "bg-muted")}
            style={{ flexGrow: ms, flexBasis: 0 }}
            title={`${seg.state ?? "No state"} ${formatClock(seg.start)}–${formatClock(seg.end)}`}
          />
        );
      })}
    </div>
  );
}
