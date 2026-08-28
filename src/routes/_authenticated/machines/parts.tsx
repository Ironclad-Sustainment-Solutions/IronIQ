import { useMemo, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
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
import { useShopParts } from "@/lib/shop-floor-api";
import { usePartCapture } from "@/lib/part-capture-api";
import { SETUP_CANDIDATE } from "@/lib/part-capture";
import { formatDate } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/machines/parts")({
  head: () => ({
    meta: [
      { title: "Parts — IronIQ" },
      {
        name: "description",
        content:
          "Look up a shop part and see machines that ran it, cycle counts, cycle time, and setup-candidate idle from captured machine events.",
      },
      { property: "og:title", content: "Parts — IronIQ" },
      {
        property: "og:description",
        content:
          "Part capture totals derived from cycle time and tagged idle — not a CNC hours tag.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PartCapturePage,
});

function PartCapturePage() {
  const { organization, facility } = useApp();
  const [query, setQuery] = useState("");
  const [lookedUp, setLookedUp] = useState<string | null>(null);
  const partsQuery = useShopParts(organization?.id, facility?.id);
  const captureQuery = usePartCapture(organization?.id, facility?.id, lookedUp);
  const capture = captureQuery.data;

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const parts = partsQuery.data ?? [];
    return parts
      .filter(
        (part) =>
          part.part_number.toLowerCase().includes(q) ||
          (part.description ?? "").toLowerCase().includes(q) ||
          part.id.toLowerCase() === q,
      )
      .slice(0, 12);
  }, [partsQuery.data, query]);

  function lookUp(partId: string) {
    const trimmed = partId.trim();
    if (!trimmed) return;
    setLookedUp(trimmed);
    setQuery(trimmed);
  }

  if (!organization || !facility) {
    return (
      <div className="mx-auto max-w-5xl space-y-8">
        <PageHeader eyebrow="Machines" title="Parts" />
        <EmptyState message="Select an organization and facility first." />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <PageHeader
        eyebrow={facility.name}
        title="Parts"
        description="Search a shop part. Totals come from captured cycle-end events and SETUP_CANDIDATE idle for that part_id. Hours to make the part is derived — it is not a CNC tag. Unmapped programs do not appear here."
        actions={
          <Button asChild variant="outline">
            <Link to="/machines">All machines</Link>
          </Button>
        }
      />

      <Panel
        title="Search part ID"
        subtitle="Matches existing shop parts, then event-derived totals"
      >
        <form
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            lookUp(query);
          }}
        >
          <div className="min-w-0 flex-1 space-y-1.5">
            <Label className="eyebrow" htmlFor="part-id-search">
              Part ID
            </Label>
            <Input
              id="part-id-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="38742"
              autoComplete="off"
            />
          </div>
          <Button type="submit">Look up</Button>
        </form>

        {query.trim() ? (
          <div className="mt-4">
            {matches.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No shop part matches this search. You can still look up the ID
                if events were captured against it.
              </p>
            ) : (
              <ul className="divide-y divide-border/60 border-t border-border">
                {matches.map((part) => (
                  <li key={part.id}>
                    <button
                      type="button"
                      className="flex w-full items-baseline justify-between gap-4 py-2.5 text-left text-sm hover:text-primary"
                      onClick={() => lookUp(part.part_number)}
                    >
                      <span className="font-medium">{part.part_number}</span>
                      <span className="truncate text-muted-foreground">
                        {part.description || part.drawing_ref || "—"}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </Panel>

      {lookedUp ? (
        captureQuery.isLoading ? (
          <EmptyState message="Loading…" />
        ) : (
          <PartTotals partId={lookedUp} capture={capture} />
        )
      ) : (
        <EmptyState message="Search a part ID to see machines, cycles, and setup idle." />
      )}
    </div>
  );
}

function PartTotals({
  partId,
  capture,
}: {
  partId: string;
  capture: ReturnType<typeof usePartCapture>["data"];
}) {
  const title = capture?.shop_part?.part_number ?? capture?.part_id ?? partId;
  const empty =
    !capture ||
    (capture.cycles === 0 && capture.setup_candidate_gaps.length === 0);

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Tag token="steel">{title}</Tag>
        {capture?.shop_part?.description ? (
          <span className="text-xs text-muted-foreground">
            {capture.shop_part.description}
          </span>
        ) : null}
      </div>

      {empty || !capture ? (
        <EmptyState message="No events for this part yet." />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-4">
            <Stat label="Cycles" value={String(capture.cycles)} />
            <Stat
              label="Cycle time"
              value={`${formatSeconds(capture.cycle_time_s)} s`}
              detail="Sum of cycle_time_s"
            />
            <Stat
              label="Setup idle"
              value={`${formatSeconds(capture.attributed_idle_s)} s`}
              detail={SETUP_CANDIDATE}
            />
            <Stat
              label="Hours to make part"
              value={String(capture.hours_to_make_part)}
              detail="Derived: cycle time + attributed idle. Not a CNC tag."
            />
          </div>

          <Panel
            title="Machines that ran it"
            subtitle={`${capture.machines.length} machine${capture.machines.length === 1 ? "" : "s"}`}
          >
            {capture.machines.length === 0 ? (
              <EmptyState message="No events for this part yet." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left">
                      {["Asset", "Name", "Cycles", "Cycle time (s)"].map(
                        (h) => (
                          <th key={h} className="eyebrow py-2 pr-4">
                            {h}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {capture.machines.map((machine) => (
                      <tr
                        key={machine.shop_machine_id}
                        className="border-b border-border/60"
                      >
                        <td className="py-2.5 pr-4">
                          <Link
                            to="/machines/$machineId"
                            params={{ machineId: machine.shop_machine_id }}
                            className="font-medium text-primary hover:underline"
                          >
                            {machine.machine_id}
                          </Link>
                        </td>
                        <td className="py-2.5 pr-4">
                          {machine.machine_name || "—"}
                        </td>
                        <td className="py-2.5 pr-4">{machine.cycles}</td>
                        <td className="py-2.5 pr-4">
                          {formatSeconds(machine.cycle_time_s)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <Panel
            title="SETUP_CANDIDATE idle"
            subtitle={`${capture.setup_candidate_gaps.length} gap${capture.setup_candidate_gaps.length === 1 ? "" : "s"}`}
          >
            {capture.setup_candidate_gaps.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No SETUP_CANDIDATE idle gaps attributed to this part.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left">
                      {["When", "Machine", "Idle (s)", "Tag"].map((h) => (
                        <th key={h} className="eyebrow py-2 pr-4">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {capture.setup_candidate_gaps.map((gap) => (
                      <tr key={gap.id} className="border-b border-border/60">
                        <td className="py-2.5 pr-4">
                          {formatWhen(gap.ts_utc)}
                        </td>
                        <td className="py-2.5 pr-4">{gap.machine_id}</td>
                        <td className="py-2.5 pr-4">
                          {formatSeconds(gap.idle_since_prev_cycle_s)}
                        </td>
                        <td className="py-2.5 pr-4">
                          <Tag token="primary">{gap.gap_class}</Tag>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </>
      )}
    </>
  );
}

function Stat({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="panel p-4">
      <p className="eyebrow">{label}</p>
      <p className="mt-1 font-display text-xl font-semibold text-foreground">
        {value}
      </p>
      {detail ? (
        <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
      ) : null}
    </div>
  );
}

function formatSeconds(value: number): string {
  if (!Number.isFinite(value)) return "0";
  return Number.isInteger(value)
    ? String(value)
    : String(Math.round(value * 1000) / 1000);
}

function formatWhen(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return formatDate(value);
  return date.toLocaleString();
}
