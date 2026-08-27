import type { ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  beforeAfterDeltas,
  formatDelta,
  type BeforeAfterNumbers,
} from "@/lib/shop-floor";

export interface BeforeAfterDraft {
  cycleTimeSecBefore: string;
  cycleTimeSecAfter: string;
  setupMinBefore: string;
  setupMinAfter: string;
  hoursOnPartBefore: string;
  hoursOnPartAfter: string;
  partsPerShiftBefore: string;
  partsPerShiftAfter: string;
  downtimeMinBefore: string;
  downtimeMinAfter: string;
  beforeAt: string;
  afterAt: string;
  whatChanged: string;
  partNumber: string;
}

export function emptyBeforeAfterDraft(
  partial?: Partial<BeforeAfterDraft>,
): BeforeAfterDraft {
  return {
    cycleTimeSecBefore: "",
    cycleTimeSecAfter: "",
    setupMinBefore: "",
    setupMinAfter: "",
    hoursOnPartBefore: "",
    hoursOnPartAfter: "",
    partsPerShiftBefore: "",
    partsPerShiftAfter: "",
    downtimeMinBefore: "",
    downtimeMinAfter: "",
    beforeAt: "",
    afterAt: "",
    whatChanged: "",
    partNumber: "",
    ...partial,
  };
}

export function draftToNumbers(draft: BeforeAfterDraft): BeforeAfterNumbers {
  const required = (value: string, label: string) => {
    const n = Number(value);
    if (value.trim() === "" || !Number.isFinite(n) || n < 0) {
      throw new Error(`${label} is required`);
    }
    return n;
  };
  const optional = (value: string) => {
    if (value.trim() === "") return null;
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) {
      throw new Error("Optional numbers must be 0 or greater");
    }
    return n;
  };
  return {
    cycle_time_sec_before: required(
      draft.cycleTimeSecBefore,
      "Cycle time before",
    ),
    cycle_time_sec_after: required(draft.cycleTimeSecAfter, "Cycle time after"),
    setup_min_before: required(draft.setupMinBefore, "Setup before"),
    setup_min_after: required(draft.setupMinAfter, "Setup after"),
    hours_on_part_before: required(
      draft.hoursOnPartBefore,
      "Hours on part before",
    ),
    hours_on_part_after: required(
      draft.hoursOnPartAfter,
      "Hours on part after",
    ),
    parts_per_shift_before: optional(draft.partsPerShiftBefore),
    parts_per_shift_after: optional(draft.partsPerShiftAfter),
    downtime_min_before: optional(draft.downtimeMinBefore),
    downtime_min_after: optional(draft.downtimeMinAfter),
  };
}

export function PartOutcomeFields({
  draft,
  onChange,
  hidePartNumber,
}: {
  draft: BeforeAfterDraft;
  onChange: (draft: BeforeAfterDraft) => void;
  hidePartNumber?: boolean;
}) {
  const set = (key: keyof BeforeAfterDraft, value: string) =>
    onChange({ ...draft, [key]: value });
  let deltas = null;
  try {
    deltas = beforeAfterDeltas(draftToNumbers(draft));
  } catch {
    deltas = null;
  }

  return (
    <div className="space-y-3">
      {hidePartNumber ? null : (
        <Field label="Part number">
          <Input
            value={draft.partNumber}
            onChange={(e) => set("partNumber", e.target.value)}
            placeholder="HUB-4410"
            required
          />
        </Field>
      )}
      <Field label="What changed (one line)">
        <Textarea
          rows={2}
          value={draft.whatChanged}
          onChange={(e) => set("whatChanged", e.target.value)}
          placeholder="Reduced feed 15% on the roughing pass"
          required
        />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Before date">
          <Input
            type="date"
            value={draft.beforeAt}
            onChange={(e) => set("beforeAt", e.target.value)}
          />
        </Field>
        <Field label="After date">
          <Input
            type="date"
            value={draft.afterAt}
            onChange={(e) => set("afterAt", e.target.value)}
          />
        </Field>
      </div>
      <Pair
        label="Cycle time (sec)"
        before={draft.cycleTimeSecBefore}
        after={draft.cycleTimeSecAfter}
        onBefore={(v) => set("cycleTimeSecBefore", v)}
        onAfter={(v) => set("cycleTimeSecAfter", v)}
        required
      />
      <Pair
        label="Setup (min)"
        before={draft.setupMinBefore}
        after={draft.setupMinAfter}
        onBefore={(v) => set("setupMinBefore", v)}
        onAfter={(v) => set("setupMinAfter", v)}
        required
      />
      <Pair
        label="Hours on part"
        before={draft.hoursOnPartBefore}
        after={draft.hoursOnPartAfter}
        onBefore={(v) => set("hoursOnPartBefore", v)}
        onAfter={(v) => set("hoursOnPartAfter", v)}
        required
      />
      <Pair
        label="Parts per shift (optional)"
        before={draft.partsPerShiftBefore}
        after={draft.partsPerShiftAfter}
        onBefore={(v) => set("partsPerShiftBefore", v)}
        onAfter={(v) => set("partsPerShiftAfter", v)}
      />
      <Pair
        label="Downtime (min, optional)"
        before={draft.downtimeMinBefore}
        after={draft.downtimeMinAfter}
        onBefore={(v) => set("downtimeMinBefore", v)}
        onAfter={(v) => set("downtimeMinAfter", v)}
      />
      {deltas ? (
        <p className="text-xs text-muted-foreground">
          Deltas: cycle {formatDelta(deltas.cycle_time_sec, "sec")} · setup{" "}
          {formatDelta(deltas.setup_min, "min")} · hours{" "}
          {formatDelta(deltas.hours_on_part, "h")}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Enter the six required before/after numbers to see deltas.
        </p>
      )}
    </div>
  );
}

function Pair({
  label,
  before,
  after,
  onBefore,
  onAfter,
  required,
}: {
  label: string;
  before: string;
  after: string;
  onBefore: (v: string) => void;
  onAfter: (v: string) => void;
  required?: boolean;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label={`${label} — before`}>
        <Input
          inputMode="decimal"
          value={before}
          onChange={(e) => onBefore(e.target.value)}
          required={required}
        />
      </Field>
      <Field label={`${label} — after`}>
        <Input
          inputMode="decimal"
          value={after}
          onChange={(e) => onAfter(e.target.value)}
          required={required}
        />
      </Field>
    </div>
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
