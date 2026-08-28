import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
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
import type { EventWindowSummary } from "@/lib/machine-improvements";
import { formatDate } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/machines/improvements")({
  head: () => ({
    meta: [
      { title: "Machine improvements — IronIQ" },
      {
        name: "description",
        content:
          "Save a machine change and compare cycles, cycle time, and setup idle before and after from captured events.",
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
        description="Save a change on a machine and part. Before and after come from captured events in the windows around that change — not from typed-in numbers."
        actions={
          <Button variant="outline" onClick={() => setAdding((v) => !v)}>
            {adding ? "Cancel" : "Save a change"}
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
        title="Saved changes"
        subtitle={
          saved.length === 0
            ? "None yet"
            : `${saved.length} saved change${saved.length === 1 ? "" : "s"}`
        }
      >
        {saved.length === 0 ? (
          <EmptyState message="No saved changes yet. Record a title, machine, part, and when it changed." />
        ) : (
          <Select value={selectedId || undefined} onValueChange={setSelectedId}>
            <SelectTrigger>
              <SelectValue placeholder="Pick a saved change" />
            </SelectTrigger>
            <SelectContent>
              {saved.map((row) => (
                <SelectItem key={row.id} value={row.id}>
                  {row.title} · {row.part_number ?? "part"} ·{" "}
                  {formatDate(row.changed_at)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </Panel>

      {selected ? (
        <Panel
          title={selected.title}
          subtitle={`${selected.machine_label ?? "Machine"} · ${selected.part_number ?? "Part"} · changed ${formatDate(selected.changed_at)} · ${selected.window_before_hours}h before / ${selected.window_after_hours}h after`}
        >
          {comparisonQuery.isLoading ? (
            <EmptyState message="Loading…" />
          ) : comparison?.status === "computed" ? (
            <BeforeAfterTable
              before={comparison.before}
              after={comparison.after}
            />
          ) : (
            <EmptyState
              message={
                comparison?.detail ?? "Before/after cannot be computed yet."
              }
            />
          )}
        </Panel>
      ) : null}
    </div>
  );
}

function BeforeAfterTable({
  before,
  after,
}: {
  before: EventWindowSummary;
  after: EventWindowSummary;
}) {
  const rows: { label: string; before: number; after: number }[] = [
    { label: "Cycles", before: before.cycles, after: after.cycles },
    {
      label: "Cycle time (sum, s)",
      before: before.cycle_time_s,
      after: after.cycle_time_s,
    },
    {
      label: "SETUP_CANDIDATE idle (s)",
      before: before.setup_candidate_idle_s,
      after: after.setup_candidate_idle_s,
    },
  ];
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left">
            {["Metric", "Before", "After"].map((h) => (
              <th key={h} className="eyebrow py-2 pr-4">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-b border-border/60">
              <td className="py-2.5 pr-4">{row.label}</td>
              <td className="py-2.5 pr-4">{row.before}</td>
              <td className="py-2.5 pr-4">{row.after}</td>
            </tr>
          ))}
        </tbody>
      </table>
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
    <Panel title="Save a change">
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
        <Field label="Window before (hours)">
          <Input
            inputMode="decimal"
            value={windowBeforeHours}
            onChange={(e) => setWindowBeforeHours(e.target.value)}
            required
          />
        </Field>
        <Field label="Window after (hours)">
          <Input
            inputMode="decimal"
            value={windowAfterHours}
            onChange={(e) => setWindowAfterHours(e.target.value)}
            required
          />
        </Field>
        <div className="flex gap-2 sm:col-span-2">
          <Button type="submit" disabled={busy || !machineId}>
            {busy ? "Saving…" : "Save change"}
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
