import { useState, type ReactNode } from "react";
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
import {
  CONTROL_LABELS,
  MACHINE_CONTROLS,
  MACHINE_PROTOCOLS,
  PROTOCOL_LABELS,
  type MachineControl,
  type MachineProtocol,
  type ShopMachine,
} from "@/lib/shop-floor";

export interface MachineDraft {
  assetId: string;
  name: string;
  make: string;
  model: string;
  control: MachineControl;
  protocol: MachineProtocol;
  location: string;
  mtconnectAgentUrl: string;
  mtconnectDeviceName: string;
  currentPartNumber: string;
}

export function emptyMachineDraft(): MachineDraft {
  return {
    assetId: "",
    name: "",
    make: "",
    model: "",
    control: "fanuc",
    protocol: "none",
    location: "",
    mtconnectAgentUrl: "",
    mtconnectDeviceName: "",
    currentPartNumber: "",
  };
}

export function draftFromMachine(machine: ShopMachine): MachineDraft {
  return {
    assetId: machine.asset_id,
    name: machine.name,
    make: machine.make,
    model: machine.model,
    control: machine.control,
    protocol: machine.protocol,
    location: machine.location ?? "",
    mtconnectAgentUrl: machine.mtconnect_agent_url ?? "",
    mtconnectDeviceName: machine.mtconnect_device_name ?? "",
    currentPartNumber: machine.current_part_number ?? "",
  };
}

export function ShopMachineForm({
  initial,
  submitLabel,
  busy,
  onSubmit,
  onCancel,
}: {
  initial?: MachineDraft;
  submitLabel: string;
  busy?: boolean;
  onSubmit: (draft: MachineDraft) => void;
  onCancel?: () => void;
}) {
  const [draft, setDraft] = useState<MachineDraft>(
    initial ?? emptyMachineDraft(),
  );
  const set = <K extends keyof MachineDraft>(key: K, value: MachineDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));
  const ready =
    draft.assetId.trim() &&
    draft.name.trim() &&
    draft.make.trim() &&
    draft.model.trim();

  return (
    <form
      className="grid gap-3 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!ready) return;
        onSubmit(draft);
      }}
    >
      <Field label="Asset ID">
        <Input
          value={draft.assetId}
          onChange={(e) => set("assetId", e.target.value)}
          placeholder="M-01"
          required
        />
      </Field>
      <Field label="Name">
        <Input
          value={draft.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder="Makino A81 #1"
          required
        />
      </Field>
      <Field label="Make">
        <Input
          value={draft.make}
          onChange={(e) => set("make", e.target.value)}
          placeholder="Makino"
          required
        />
      </Field>
      <Field label="Model">
        <Input
          value={draft.model}
          onChange={(e) => set("model", e.target.value)}
          placeholder="A81"
          required
        />
      </Field>
      <Field label="Control">
        <Select
          value={draft.control}
          onValueChange={(v) => set("control", v as MachineControl)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MACHINE_CONTROLS.map((c) => (
              <SelectItem key={c} value={c}>
                {CONTROL_LABELS[c]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Protocol">
        <Select
          value={draft.protocol}
          onValueChange={(v) => set("protocol", v as MachineProtocol)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MACHINE_PROTOCOLS.map((p) => (
              <SelectItem key={p} value={p}>
                {PROTOCOL_LABELS[p]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {draft.protocol !== "mtconnect" ? (
          <p className="mt-1 text-xs text-muted-foreground">
            Select MTConnect to set up a live data feed from this machine
            instead of logging runs manually.
          </p>
        ) : null}
      </Field>
      <div className="sm:col-span-2">
        <Field label="Location">
          <Input
            value={draft.location}
            onChange={(e) => set("location", e.target.value)}
            placeholder="Cell 2 / north wall"
          />
        </Field>
      </div>
      {draft.protocol === "mtconnect" ? (
        <>
          <div className="sm:col-span-2">
            <Field label="MTConnect agent URL">
              <Input
                value={draft.mtconnectAgentUrl}
                onChange={(e) => set("mtconnectAgentUrl", e.target.value)}
                placeholder="http://192.168.1.50:5000"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                For a machine on a private shop LAN, run the Edge app on that
                network (facility key from Floor setup). Cloud "Sync now" only
                works when this URL is reachable from the public internet — a
                public IP/hostname or a forwarded port — not 192.168.x.x.
              </p>
            </Field>
          </div>
          <Field label="Device name (optional)">
            <Input
              value={draft.mtconnectDeviceName}
              onChange={(e) => set("mtconnectDeviceName", e.target.value)}
              placeholder="VMC-3Axis"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Leave blank if the agent only serves one device.
            </p>
          </Field>
          <Field label="Current part number (fallback)">
            <Input
              value={draft.currentPartNumber}
              onChange={(e) => set("currentPartNumber", e.target.value)}
              placeholder="1004-A"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Used only when the agent doesn't report a part number itself.
            </p>
          </Field>
        </>
      ) : null}
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" disabled={!ready || busy}>
          {submitLabel}
        </Button>
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="eyebrow">{label}</Label>
      {children}
    </div>
  );
}
