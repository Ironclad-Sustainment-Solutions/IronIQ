import { useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import {
  PageHeader,
  Panel,
  EmptyState,
  DefinitionList,
} from "@/components/ironiq/layout-primitives";
import { Tag } from "@/components/ironiq/badges";
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
import {
  ShopMachineForm,
  draftFromMachine,
} from "@/components/ironiq/shop-machine-form";
import {
  useCreateMachineRun,
  useGenerateMachineBridgeApiKey,
  useImportMachineRunsCsv,
  useMachineLiveState,
  useMachineRuns,
  useShopMachine,
  useUpdateShopMachine,
} from "@/lib/shop-floor-api";
import {
  CONNECTION_LABELS,
  CONTROL_LABELS,
  PROTOCOL_LABELS,
  RUN_CSV_HEADERS,
  summarizeMachineRuns,
} from "@/lib/shop-floor";
import { formatDate } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/machines/$machineId")({
  head: () => ({
    meta: [
      { title: "Machine — IronIQ" },
      {
        name: "description",
        content:
          "Machine detail: last cycle, runtime vs idle vs down, hours on a selected part, and recent manual or CSV runs.",
      },
    ],
  }),
  component: MachineDetailPage,
});

function MachineDetailPage() {
  const { machineId } = Route.useParams();
  const { organization, facility } = useApp();
  const machineQuery = useShopMachine(machineId);
  const machine = machineQuery.data ?? null;
  const runs = useMachineRuns(machineId).data ?? [];
  const update = useUpdateShopMachine(organization?.id, facility?.id);
  const logRun = useCreateMachineRun(machineId);
  const importCsv = useImportMachineRunsCsv(machineId);
  const liveState = useMachineLiveState(machineId).data ?? null;
  const generateKey = useGenerateMachineBridgeApiKey(machineId);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [selectedPart, setSelectedPart] = useState<string>("all");
  const [runForm, setRunForm] = useState({
    occurredAt: new Date().toISOString().slice(0, 16),
    partNumber: "",
    cycles: "",
    runtimeMinutes: "",
    idleMinutes: "",
    downtimeMinutes: "",
  });

  if (machineQuery.isLoading) {
    return (
      <div className="mx-auto max-w-5xl space-y-8">
        <PageHeader eyebrow="Machines" title="Machine" />
        <EmptyState message="Loading…" />
      </div>
    );
  }

  if (!machine) {
    return (
      <div className="mx-auto max-w-5xl space-y-8">
        <PageHeader eyebrow="Machines" title="Machine" />
        <EmptyState message="Machine not found, or you do not have access." />
      </div>
    );
  }

  const summary = summarizeMachineRuns(
    runs,
    selectedPart === "all" ? null : selectedPart,
  );
  const parts = summary.hoursByPart.map((p) => p.part_number);
  const selectedHours =
    selectedPart === "all"
      ? summary.totals.hours
      : (summary.hoursByPart.find((p) => p.part_number === selectedPart)
          ?.hours ?? 0);

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <PageHeader
        eyebrow={facility?.name ?? "Machines"}
        title={machine.name}
        description={`${machine.make} ${machine.model} · ${CONTROL_LABELS[machine.control]}`}
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link to="/machines">All machines</Link>
            </Button>
            <Button variant="outline" onClick={() => setEditing((v) => !v)}>
              {editing ? "Close" : "Edit"}
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Tag token="steel">{machine.asset_id}</Tag>
        <Tag
          token={
            machine.connection_status === "not_connected" ? "steel" : "primary"
          }
        >
          {CONNECTION_LABELS[machine.connection_status]}
        </Tag>
        <span className="text-xs text-muted-foreground">
          {PROTOCOL_LABELS[machine.protocol]}
          {machine.location ? ` · ${machine.location}` : ""}
        </span>
      </div>

      {machine.protocol === "mtconnect" ? (
        <Panel title="MTConnect bridge agent">
          {machine.mtconnect_agent_url ? (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                <p>
                  Local agent:{" "}
                  <span className="text-foreground">
                    {machine.mtconnect_agent_url}
                  </span>
                  {machine.mtconnect_device_name
                    ? ` · device: ${machine.mtconnect_device_name}`
                    : ""}
                </p>
                {liveState?.last_polled_at ? (
                  <p className="mt-1">
                    Last received {formatDate(liveState.last_polled_at)} —{" "}
                    {liveState.last_execution ?? "unknown state"}
                    {liveState.last_part_count != null
                      ? ` · part count ${liveState.last_part_count}`
                      : ""}
                  </p>
                ) : (
                  <p className="mt-1">No data received yet.</p>
                )}
                {liveState?.last_error ? (
                  <p className="mt-1 text-destructive">
                    Last push failed: {liveState.last_error}
                  </p>
                ) : null}
              </div>

              <div className="rounded-md border border-border p-4">
                <p className="text-sm font-medium text-foreground">
                  This app runs in the cloud and can't reach a machine on your
                  local network directly — a small bridge agent runs on any PC
                  on the same network as the MTConnect agent and pushes readings
                  out to IronIQ over HTTPS. It never needs an open inbound port.
                </p>

                {revealedKey ? (
                  <div className="mt-3 rounded-md bg-muted p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Bridge API key — copy it now, it won't be shown again
                    </p>
                    <code className="mt-1 block break-all text-sm text-foreground">
                      {revealedKey}
                    </code>
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {machine.bridge_api_key_hint
                      ? `Active key ends in …${machine.bridge_api_key_hint} (created ${
                          machine.bridge_api_key_created_at
                            ? formatDate(machine.bridge_api_key_created_at)
                            : "recently"
                        }). Generating a new one replaces it immediately.`
                      : "No bridge API key yet — generate one to set up the bridge."}
                  </p>
                )}

                <div className="mt-3 flex gap-2">
                  <Button
                    variant="outline"
                    disabled={generateKey.isPending}
                    onClick={() =>
                      generateKey.mutate(undefined, {
                        onSuccess: (result) => setRevealedKey(result.apiKey),
                      })
                    }
                  >
                    {generateKey.isPending
                      ? "Generating…"
                      : machine.bridge_api_key_hint
                        ? "Generate new key"
                        : "Generate bridge API key"}
                  </Button>
                </div>

                {revealedKey ? (
                  <pre className="mt-3 overflow-x-auto rounded-md bg-muted p-3 text-xs text-foreground">
                    {`mtconnect-bridge \\
  --agent-url ${machine.mtconnect_agent_url} \\
  ${machine.mtconnect_device_name ? `--device "${machine.mtconnect_device_name}" \\\n  ` : ""}--machine-id ${machine.id} \\
  --api-key ${revealedKey} \\
  --ingest-url https://<your-ironiq-domain>/api/machines/${machine.id}/ingest`}
                  </pre>
                ) : null}
              </div>
            </div>
          ) : (
            <EmptyState message="Add an MTConnect agent URL under Edit to set up the bridge agent." />
          )}
        </Panel>
      ) : null}

      {editing ? (
        <Panel title="Edit machine">
          <ShopMachineForm
            initial={draftFromMachine(machine)}
            submitLabel="Save"
            busy={update.isPending}
            onSubmit={(draft) =>
              update.mutate(
                { id: machine.id, ...draft },
                { onSuccess: () => setEditing(false) },
              )
            }
            onCancel={() => setEditing(false)}
          />
        </Panel>
      ) : null}

      {runs.length === 0 ? (
        <EmptyState message="not connected — add a manual run or CSV" />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-4">
            <Stat
              label="Last cycle"
              value={
                summary.lastRun
                  ? `${summary.lastRun.cycles} · ${formatDate(summary.lastRun.occurred_at)}`
                  : "—"
              }
              detail={summary.lastRun?.part_number}
            />
            <Stat
              label="Runtime"
              value={`${summary.totals.runtime_minutes} min`}
              detail={`${summary.totals.hours} hours`}
            />
            <Stat
              label="Idle / down"
              value={`${summary.totals.idle_minutes} / ${summary.totals.downtime_minutes} min`}
            />
            <Stat
              label="Hours on part"
              value={`${selectedHours}`}
              detail={selectedPart === "all" ? "All parts" : selectedPart}
            />
          </div>

          <Panel title="Hours by part">
            <div className="mb-4 max-w-xs">
              <Label className="eyebrow">Selected part</Label>
              <Select value={selectedPart} onValueChange={setSelectedPart}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All parts</SelectItem>
                  {parts.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DefinitionList
              items={summary.hoursByPart.map((p) => ({
                label: p.part_number,
                value: `${p.hours} h · ${p.cycles} cycles`,
              }))}
            />
          </Panel>
        </>
      )}

      <Panel title="Add a manual run">
        <form
          className="grid gap-3 sm:grid-cols-3"
          onSubmit={(e) => {
            e.preventDefault();
            logRun.mutate(
              {
                occurredAt: new Date(runForm.occurredAt).toISOString(),
                partNumber: runForm.partNumber,
                cycles: Number(runForm.cycles),
                runtimeMinutes: Number(runForm.runtimeMinutes),
                idleMinutes: Number(runForm.idleMinutes || 0),
                downtimeMinutes: Number(runForm.downtimeMinutes || 0),
              },
              {
                onSuccess: () =>
                  setRunForm((f) => ({
                    ...f,
                    partNumber: "",
                    cycles: "",
                    runtimeMinutes: "",
                    idleMinutes: "",
                    downtimeMinutes: "",
                  })),
              },
            );
          }}
        >
          <Field label="Timestamp">
            <Input
              type="datetime-local"
              value={runForm.occurredAt}
              onChange={(e) =>
                setRunForm((f) => ({ ...f, occurredAt: e.target.value }))
              }
              required
            />
          </Field>
          <Field label="Part number">
            <Input
              value={runForm.partNumber}
              onChange={(e) =>
                setRunForm((f) => ({ ...f, partNumber: e.target.value }))
              }
              placeholder="HUB-4410"
              required
            />
          </Field>
          <Field label="Cycles">
            <Input
              inputMode="decimal"
              value={runForm.cycles}
              onChange={(e) =>
                setRunForm((f) => ({ ...f, cycles: e.target.value }))
              }
              required
            />
          </Field>
          <Field label="Runtime (min)">
            <Input
              inputMode="decimal"
              value={runForm.runtimeMinutes}
              onChange={(e) =>
                setRunForm((f) => ({ ...f, runtimeMinutes: e.target.value }))
              }
              required
            />
          </Field>
          <Field label="Idle (min)">
            <Input
              inputMode="decimal"
              value={runForm.idleMinutes}
              onChange={(e) =>
                setRunForm((f) => ({ ...f, idleMinutes: e.target.value }))
              }
            />
          </Field>
          <Field label="Downtime (min)">
            <Input
              inputMode="decimal"
              value={runForm.downtimeMinutes}
              onChange={(e) =>
                setRunForm((f) => ({ ...f, downtimeMinutes: e.target.value }))
              }
            />
          </Field>
          <div className="sm:col-span-3">
            <Button type="submit" disabled={logRun.isPending}>
              Log run
            </Button>
          </div>
        </form>
      </Panel>

      <Panel
        title="Import CSV"
        subtitle={`Headers: ${RUN_CSV_HEADERS.join(", ")}`}
      >
        <input
          type="file"
          accept=".csv,text/csv"
          className="block text-sm text-muted-foreground"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            void file.text().then((text) => importCsv.mutate(text));
            e.target.value = "";
          }}
        />
        <p className="mt-2 text-xs text-muted-foreground">
          Sample file in the repo: samples/shop-floor-runs.csv
        </p>
      </Panel>

      <Panel title="Last 20 runs" subtitle={`${summary.last20.length} shown`}>
        {summary.last20.length === 0 ? (
          <EmptyState message="not connected — add a manual run or CSV" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  {[
                    "When",
                    "Part",
                    "Cycles",
                    "Runtime",
                    "Idle",
                    "Down",
                    "Source",
                  ].map((h) => (
                    <th key={h} className="eyebrow py-2 pr-4">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {summary.last20.map((r) => (
                  <tr key={r.id} className="border-b border-border/60">
                    <td className="py-2.5 pr-4">{formatDate(r.occurred_at)}</td>
                    <td className="py-2.5 pr-4">{r.part_number}</td>
                    <td className="py-2.5 pr-4">{r.cycles}</td>
                    <td className="py-2.5 pr-4">{r.runtime_minutes}</td>
                    <td className="py-2.5 pr-4">{r.idle_minutes}</td>
                    <td className="py-2.5 pr-4">{r.downtime_minutes}</td>
                    <td className="py-2.5 pr-4">{r.source}</td>
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
