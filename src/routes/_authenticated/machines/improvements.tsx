import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  DefinitionList,
  PageHeader,
  Panel,
  EmptyState,
} from "@/components/ironiq/layout-primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useApp } from "@/context/app-context";
import { useShopMachines, useShopParts } from "@/lib/shop-floor-api";
import { machineLabel } from "@/lib/shop-floor";
import {
  useCreateMachineImprovement,
  useMachineImprovementComparison,
  useMachineImprovements,
} from "@/lib/machine-improvements-api";
import {
  EMPTY_WINDOW_MESSAGE,
  firstPieceLostHours,
  formatHours,
  formatHoursDelta,
  formatTimestamp,
  formatWindowRange,
  hoursToMakePart,
  improvementWindows,
  setupLostHours,
  type EventWindowSummary,
  type ImprovementComparison,
  type ShopMachineImprovement,
  type WindowResult,
} from "@/lib/machine-improvements";

export const Route = createFileRoute("/_authenticated/machines/improvements")({
  head: () => ({
    meta: [
      { title: "Machine improvements — IronIQ" },
      {
        name: "description",
        content:
          "Lock a baseline on a named part, then measure cycles and hours after from captured machine events.",
      },
    ],
  }),
  component: MachineImprovementsPage,
});

function MachineImprovementsPage() {
  const { organization, facility } = useApp();
  const machines = useShopMachines(organization?.id, facility?.id).data ?? [];
  const parts = useShopParts(organization?.id, facility?.id).data ?? [];
  const saved =
    useMachineImprovements(organization?.id, facility?.id).data ?? [];
  const create = useCreateMachineImprovement(organization?.id, facility?.id);
  const [selectedId, setSelectedId] = useState<string>("");
  const [adding, setAdding] = useState(false);
  const comparisonQuery = useMachineImprovementComparison(selectedId || null);
  const selected =
    saved.find((row) => row.id === selectedId) ??
    comparisonQuery.data?.improvement ??
    null;
  const comparison = comparisonQuery.data?.comparison ?? null;

  if (!organization || !facility) {
    return (
      <div className="mx-auto max-w-5xl space-y-8">
        <PageHeader eyebrow="Machines" title="Improvements" />
        <EmptyState message="Select an organization and facility first." />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <PageHeader
        eyebrow={facility.name}
        title="Improvements"
        description="Lock a baseline on a named part. After the change, cycles and hours come from machine events — not from numbers typed in."
        actions={
          <Button variant="outline" onClick={() => setAdding((v) => !v)}>
            {adding ? "Cancel" : "Lock a baseline"}
          </Button>
        }
      />

      {adding ? (
        <SaveChangeForm
          machines={machines}
          parts={parts}
          busy={create.isPending}
          onCancel={() => setAdding(false)}
          onSubmit={(input) =>
            create.mutate(input, {
              onSuccess: (row) => {
                setAdding(false);
                setSelectedId(row.id);
              },
            })
          }
        />
      ) : null}

      <Panel
        title="Saved baselines"
        subtitle={
          saved.length === 0
            ? "None yet"
            : `${saved.length} saved change${saved.length === 1 ? "" : "s"}`
        }
      >
        {saved.length === 0 ? (
          <EmptyState message="No baseline locked yet. Pick a part, machine, and when the change happened." />
        ) : (
          <Select value={selectedId || undefined} onValueChange={setSelectedId}>
            <SelectTrigger>
              <SelectValue placeholder="Pick a saved change" />
            </SelectTrigger>
            <SelectContent>
              {saved.map((row) => (
                <SelectItem key={row.id} value={row.id}>
                  {row.title} · {row.part_number ?? "part"} ·{" "}
                  {formatTimestamp(row.changed_at)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </Panel>

      {selected ? (
        <BaselineReport
          improvement={selected}
          comparison={comparison}
          loading={comparisonQuery.isLoading}
        />
      ) : null}
    </div>
  );
}

function BaselineReport({
  improvement,
  comparison,
  loading,
}: {
  improvement: ShopMachineImprovement;
  comparison: ImprovementComparison | null;
  loading: boolean;
}) {
  const bounds = improvementWindows(improvement);
  return (
    <Panel title={improvement.title}>
      <div className="space-y-6">
        <DefinitionList
          items={[
            { label: "Part", value: improvement.part_number ?? "—" },
            { label: "Machine", value: improvement.machine_label ?? "—" },
            { label: "Plant", value: improvement.plant_name ?? "—" },
            { label: "Title", value: improvement.title },
            {
              label: "Changed",
              value: formatTimestamp(improvement.changed_at),
            },
          ]}
        />
        <DefinitionList
          items={[
            {
              label: "Baseline window",
              value: formatWindowRange(bounds.beforeStart, bounds.changedAt),
            },
            {
              label: "After window",
              value: formatWindowRange(bounds.changedAt, bounds.afterEnd),
            },
          ]}
        />
        {loading ? (
          <EmptyState message="Loading…" />
        ) : comparison?.status === "unavailable" ? (
          <EmptyState message={comparison.detail} />
        ) : comparison?.status === "report" ? (
          <ReportWindows before={comparison.before} after={comparison.after} />
        ) : (
          <EmptyState message={EMPTY_WINDOW_MESSAGE} />
        )}
      </div>
    </Panel>
  );
}

function ReportWindows({
  before,
  after,
}: {
  before: WindowResult;
  after: WindowResult;
}) {
  const showFirstPiece =
    (before.status === "ok" &&
      before.summary.first_piece_candidate_idle_s > 0) ||
    (after.status === "ok" && after.summary.first_piece_candidate_idle_s > 0);
  const bothOk = before.status === "ok" && after.status === "ok";

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        <WindowColumn
          title="Baseline"
          result={before}
          showFirstPiece={showFirstPiece}
        />
        <WindowColumn
          title="After"
          result={after}
          showFirstPiece={showFirstPiece}
        />
      </div>
      {bothOk ? (
        <ChangeStrip
          before={before.summary}
          after={after.summary}
          showFirstPiece={showFirstPiece}
        />
      ) : null}
    </div>
  );
}

function WindowColumn({
  title,
  result,
  showFirstPiece,
}: {
  title: string;
  result: WindowResult;
  showFirstPiece: boolean;
}) {
  return (
    <div className="rounded-md border border-border p-4">
      <h3 className="text-sm font-semibold uppercase tracking-wider">
        {title}
      </h3>
      {result.status === "empty" ? (
        <p className="mt-3 text-sm text-muted-foreground">
          {EMPTY_WINDOW_MESSAGE}
        </p>
      ) : (
        <dl className="mt-3 space-y-3">
          <Metric label="Cycles" value={String(result.summary.cycles)} />
          <Metric
            label="Hours to make a part"
            value={formatHours(hoursToMakePart(result.summary))}
          />
          <Metric
            label="Lost hours (setup)"
            value={formatHours(setupLostHours(result.summary))}
          />
          {showFirstPiece ? (
            <Metric
              label="Lost hours (first piece)"
              value={formatHours(firstPieceLostHours(result.summary))}
            />
          ) : null}
        </dl>
      )}
    </div>
  );
}

function ChangeStrip({
  before,
  after,
  showFirstPiece,
}: {
  before: EventWindowSummary;
  after: EventWindowSummary;
  showFirstPiece: boolean;
}) {
  const cycleDelta = after.cycles - before.cycles;
  const cycleSign = cycleDelta > 0 ? "+" : "";
  return (
    <div className="rounded-md border border-border bg-muted/20 p-4">
      <h3 className="text-sm font-semibold uppercase tracking-wider">Change</h3>
      <dl className="mt-3 grid gap-3 sm:grid-cols-2">
        <Metric label="Cycles" value={`${cycleSign}${cycleDelta}`} />
        <Metric
          label="Hours to make a part"
          value={formatHoursDelta(
            hoursToMakePart(before),
            hoursToMakePart(after),
          )}
        />
        <Metric
          label="Lost hours (setup)"
          value={formatHoursDelta(
            setupLostHours(before),
            setupLostHours(after),
          )}
        />
        {showFirstPiece ? (
          <Metric
            label="Lost hours (first piece)"
            value={formatHoursDelta(
              firstPieceLostHours(before),
              firstPieceLostHours(after),
            )}
          />
        ) : null}
      </dl>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="eyebrow">{label}</dt>
      <dd className="mt-1 text-sm text-foreground">{value}</dd>
    </div>
  );
}

function SaveChangeForm({
  machines,
  parts,
  busy,
  onSubmit,
  onCancel,
}: {
  machines: { id: string; asset_id: string; name: string }[];
  parts: { id: string; part_number: string }[];
  busy?: boolean;
  onSubmit: (input: {
    machineId: string;
    partId?: string;
    partNumber?: string;
    title: string;
    changedAt: string;
    windowBeforeHours: number;
    windowAfterHours: number;
  }) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [machineId, setMachineId] = useState(machines[0]?.id ?? "");
  const [partId, setPartId] = useState(parts[0]?.id ?? "");
  const [partNumber, setPartNumber] = useState("");
  const [changedAt, setChangedAt] = useState(
    new Date().toISOString().slice(0, 16),
  );
  const [windowBeforeHours, setWindowBeforeHours] = useState("24");
  const [windowAfterHours, setWindowAfterHours] = useState("24");

  return (
    <Panel title="Lock a baseline">
      <form
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          const before = Number(windowBeforeHours);
          const after = Number(windowAfterHours);
          if (!Number.isFinite(before) || before <= 0) return;
          if (!Number.isFinite(after) || after <= 0) return;
          onSubmit({
            machineId,
            partId: partId || undefined,
            partNumber: partId ? undefined : partNumber.trim() || undefined,
            title: title.trim(),
            changedAt: new Date(changedAt).toISOString(),
            windowBeforeHours: before,
            windowAfterHours: after,
          });
        }}
      >
        <Field label="Title">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Program Rev B + fixture"
            required
          />
        </Field>
        <Field label="Changed at">
          <Input
            type="datetime-local"
            value={changedAt}
            onChange={(e) => setChangedAt(e.target.value)}
            required
          />
        </Field>
        <Field label="Machine">
          <Select value={machineId || undefined} onValueChange={setMachineId}>
            <SelectTrigger>
              <SelectValue placeholder="Select a machine" />
            </SelectTrigger>
            <SelectContent>
              {machines.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {machineLabel(m)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Part">
          {parts.length > 0 ? (
            <Select value={partId || undefined} onValueChange={setPartId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a part" />
              </SelectTrigger>
              <SelectContent>
                {parts.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.part_number}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              value={partNumber}
              onChange={(e) => setPartNumber(e.target.value)}
              placeholder="HUB-4410"
              required
            />
          )}
        </Field>
        <Field label="Baseline window (hours)">
          <Input
            inputMode="decimal"
            value={windowBeforeHours}
            onChange={(e) => setWindowBeforeHours(e.target.value)}
            required
          />
        </Field>
        <Field label="After window (hours)">
          <Input
            inputMode="decimal"
            value={windowAfterHours}
            onChange={(e) => setWindowAfterHours(e.target.value)}
            required
          />
        </Field>
        <div className="flex gap-2 sm:col-span-2">
          <Button type="submit" disabled={busy || !machineId}>
            {busy ? "Saving…" : "Lock baseline"}
          </Button>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </form>
    </Panel>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="eyebrow">{label}</Label>
      {children}
    </div>
  );
}
