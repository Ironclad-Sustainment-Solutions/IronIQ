import { useId, useMemo, useRef, useState } from "react";
import { Camera, Loader2, Paperclip, Trash2, X, Zap } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { TagPicker } from "./review-parts";
import {
  EVIDENCE_CLASSES,
  FIELD_DOMAINS,
  GAP_SEVERITY,
  IRONCLAD_ACTIONS,
  PRODUCTION_IMPACT_OPTIONS,
  domainByCode,
  type FieldAttachmentRow,
  type FieldCaptureObservationRow,
} from "@/lib/field-domains";
import { FIELD_SCALE } from "@/lib/field-form";
import { useEvidenceUrl } from "@/lib/field-capture-api";

/** Preliminary field rating pad — 1–5 plus Not Observed. */
export function RatingPad({
  rating,
  notObserved,
  onChange,
  disabled,
}: {
  rating: number | null;
  notObserved: boolean;
  onChange: (v: { rating: number | null; not_observed: boolean }) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid gap-1.5">
      <Label className="eyebrow">Preliminary field rating</Label>
      <div className="grid grid-cols-6 gap-1.5">
        {FIELD_SCALE.map((s) => (
          <button
            key={s.value}
            type="button"
            disabled={disabled || notObserved}
            title={`${s.label} — ${s.description}`}
            onClick={() =>
              onChange({
                rating: rating === s.value ? null : s.value,
                not_observed: false,
              })
            }
            className={cn(
              "flex h-12 flex-col items-center justify-center rounded-sm border font-display text-base font-semibold transition-colors",
              rating === s.value && !notObserved
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-muted-foreground hover:border-primary/60 hover:text-foreground",
              (disabled || notObserved) && "opacity-40",
            )}
          >
            {s.value}
            <span className="mt-0.5 w-full truncate px-0.5 text-center text-[8px] font-medium uppercase">
              {s.label}
            </span>
          </button>
        ))}
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange({ rating: null, not_observed: !notObserved })}
          className={cn(
            "h-12 rounded-sm border font-display text-xs font-semibold uppercase transition-colors",
            notObserved
              ? "border-primary bg-primary/15 text-foreground"
              : "border-border text-muted-foreground hover:text-foreground",
          )}
        >
          N/O
        </button>
      </div>
    </div>
  );
}

export interface ObservationDraft {
  domain_code: string;
  category: string | null;
  area: string;
  machine: string;
  production_cell: string;
  process: string;
  observed_condition: string;
  objective_evidence: string;
  assessor_notes: string;
  context_source: string;
  rating: number | null;
  not_observed: boolean;
  evidence_class: string;
}

const emptyDraft = (domain: string): ObservationDraft => ({
  domain_code: domain,
  category: null,
  area: "",
  machine: "",
  production_cell: "",
  process: "",
  observed_condition: "",
  objective_evidence: "",
  assessor_notes: "",
  context_source: "",
  rating: null,
  not_observed: false,
  evidence_class: "Observed",
});

/**
 * Fast observation entry. `quickWalk` trims the form to the six questions an
 * assessor can answer in 30–60 seconds while standing at a machine.
 */
export function ObservationDialog({
  open,
  onOpenChange,
  domainCode,
  initial,
  quickWalk,
  saving,
  onSave,
  onUploadPhoto,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  domainCode?: string;
  initial?: FieldCaptureObservationRow | null;
  quickWalk?: boolean;
  saving?: boolean;
  onSave: (
    draft: ObservationDraft,
    opts: { addAnother: boolean; photo: File | null },
  ) => void;
  onUploadPhoto?: boolean;
}) {
  const start = useMemo<ObservationDraft>(
    () =>
      initial
        ? {
            domain_code: initial.domain_code,
            category: initial.category,
            area: initial.area ?? "",
            machine: initial.machine ?? "",
            production_cell: initial.production_cell ?? "",
            process: initial.process ?? "",
            observed_condition: initial.observed_condition ?? "",
            objective_evidence: initial.objective_evidence ?? "",
            assessor_notes: initial.assessor_notes ?? "",
            context_source: initial.context_source ?? "",
            rating: initial.rating,
            not_observed: initial.not_observed,
            evidence_class: initial.evidence_class ?? "Observed",
          }
        : emptyDraft(domainCode ?? FIELD_DOMAINS[0]!.code),
    [initial, domainCode, open],
  );

  const [draft, setDraft] = useState<ObservationDraft>(start);
  const [photo, setPhoto] = useState<File | null>(null);
  const [key, setKey] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  // Reset when the dialog is re-opened for a different target.
  const signature = `${initial?.id ?? "new"}-${domainCode ?? ""}-${open}`;
  const [lastSignature, setLastSignature] = useState(signature);
  if (signature !== lastSignature) {
    setLastSignature(signature);
    setDraft(start);
    setPhoto(null);
  }

  const set = (values: Partial<ObservationDraft>) =>
    setDraft((d) => ({ ...d, ...values }));
  const domain = domainByCode(draft.domain_code);

  const save = (addAnother: boolean) => {
    onSave(draft, { addAnother, photo });
    if (addAnother) {
      setDraft({
        ...emptyDraft(draft.domain_code),
        area: draft.area,
        machine: draft.machine,
      });
      setPhoto(null);
      setKey((k) => k + 1);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92dvh] w-[calc(100vw-1rem)] max-w-2xl flex-col gap-0 overflow-hidden p-0 sm:w-full">
        <DialogHeader className="shrink-0 border-b border-border px-4 py-3 pr-10 sm:px-6">
          <DialogTitle className="uppercase tracking-wide">
            {initial
              ? "Edit observation"
              : quickWalk
                ? "Quick walk observation"
                : "Add observation"}
          </DialogTitle>
          <DialogDescription>
            {domain ? domain.title : "Field observation"} — nothing here is
            required. Capture what you can and move on.
          </DialogDescription>
        </DialogHeader>

        <div
          className="grid flex-1 gap-4 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6"
          key={key}
        >
          {!domainCode || initial ? (
            <TagPicker
              label="Capability domain"
              single
              options={FIELD_DOMAINS.map((d) => d.title)}
              selected={domain ? [domain.title] : []}
              onChange={(v) => {
                const next = FIELD_DOMAINS.find((d) => d.title === v[0]);
                set({
                  domain_code: next?.code ?? draft.domain_code,
                  category: null,
                });
              }}
            />
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="Area / department"
              value={draft.area}
              onChange={(v) => set({ area: v })}
            />
            <Field
              label="Machine"
              value={draft.machine}
              onChange={(v) => set({ machine: v })}
            />
            {!quickWalk ? (
              <>
                <Field
                  label="Production cell"
                  value={draft.production_cell}
                  onChange={(v) => set({ production_cell: v })}
                />
                <Field
                  label="Process"
                  value={draft.process}
                  onChange={(v) => set({ process: v })}
                />
              </>
            ) : null}
          </div>

          {domain && !quickWalk ? (
            <TagPicker
              label="Observation category"
              single
              options={domain.categories}
              selected={draft.category ? [draft.category] : []}
              onChange={(v) => set({ category: v[0] ?? null })}
            />
          ) : null}

          <Area
            label="What did you observe?"
            value={draft.observed_condition}
            onChange={(v) => set({ observed_condition: v })}
            placeholder="Observed condition"
          />
          <Area
            label="What evidence supports it?"
            value={draft.objective_evidence}
            onChange={(v) => set({ objective_evidence: v })}
            placeholder="Objective evidence — counts, times, documents, what you saw or measured"
          />

          <RatingPad
            rating={draft.rating}
            notObserved={draft.not_observed}
            onChange={(v) => set(v)}
          />

          <TagPicker
            label="Evidence classification"
            single
            options={EVIDENCE_CLASSES}
            selected={[draft.evidence_class]}
            onChange={(v) => set({ evidence_class: v[0] ?? "Observed" })}
          />

          {!quickWalk ? (
            <>
              <Field
                label="Employee / role providing context"
                value={draft.context_source}
                onChange={(v) => set({ context_source: v })}
              />
              <Area
                label="Assessor notes"
                value={draft.assessor_notes}
                onChange={(v) => set({ assessor_notes: v })}
              />
            </>
          ) : null}

          {onUploadPhoto ? (
            <div className="grid gap-1.5">
              <Label className="eyebrow">Photo / document evidence</Label>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileRef.current?.click()}
                >
                  <Camera className="size-4" aria-hidden /> Attach
                </Button>
                {photo ? (
                  <span className="truncate text-xs text-muted-foreground">
                    {photo.name}
                  </span>
                ) : null}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*,application/pdf"
                  className="hidden"
                  onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
                />
              </div>
            </div>
          ) : null}
        </div>

        <DialogFooter className="shrink-0 gap-2 border-t border-border bg-background px-4 py-3 sm:justify-between sm:px-6">
          <Button
            variant="ghost"
            className="hidden sm:inline-flex"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <div className="flex flex-col gap-2 sm:flex-row">
            {!initial ? (
              <Button
                variant="outline"
                disabled={saving}
                onClick={() => save(true)}
              >
                Save &amp; add another
              </Button>
            ) : null}
            <Button disabled={saving} onClick={() => save(false)}>
              {saving ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : null}{" "}
              Save observation
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const id = useId();
  return (
    <div className="grid gap-1.5">
      <Label className="eyebrow" htmlFor={id}>
        {label}
      </Label>
      <Input
        id={id}
        value={value}
        maxLength={200}
        className="h-11 text-base"
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function Area({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const id = useId();
  return (
    <div className="grid gap-1.5">
      <Label className="eyebrow" htmlFor={id}>
        {label}
      </Label>
      <Textarea
        id={id}
        rows={3}
        value={value}
        placeholder={placeholder}
        maxLength={4000}
        className="text-base"
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

/* ------------------------------ quick capture ----------------------------- */

export function QuickCaptureDialog({
  open,
  onOpenChange,
  saving,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  saving?: boolean;
  onSave: (values: {
    note: string;
    area: string;
    machine: string;
    domain_code: string | null;
    potential_problem: string;
    photo: File | null;
  }) => void;
}) {
  const [note, setNote] = useState("");
  const [area, setArea] = useState("");
  const [machine, setMachine] = useState("");
  const [domain, setDomain] = useState<string | null>(null);
  const [problem, setProblem] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [listening, setListening] = useState(false);

  const dictate = () => {
    interface MinimalSpeechRecognition {
      continuous: boolean;
      interimResults: boolean;
      onresult:
        ((e: { results: { 0: { 0: { transcript: string } } } }) => void) | null;
      onend: (() => void) | null;
      start: () => void;
    }
    const w = window as unknown as {
      webkitSpeechRecognition?: new () => MinimalSpeechRecognition;
      SpeechRecognition?: new () => MinimalSpeechRecognition;
    };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) return;
    const rec = new Ctor();
    rec.continuous = false;
    rec.interimResults = false;
    rec.onresult = (e: { results: { 0: { 0: { transcript: string } } } }) => {
      setNote((n) => `${n}${n ? " " : ""}${e.results[0][0].transcript}`);
    };
    rec.onend = () => setListening(false);
    setListening(true);
    rec.start();
  };

  const reset = () => {
    setNote("");
    setArea("");
    setMachine("");
    setDomain(null);
    setProblem("");
    setPhoto(null);
  };

  const speechAvailable =
    typeof window !== "undefined" &&
    Boolean(
      (
        window as unknown as {
          webkitSpeechRecognition?: unknown;
          SpeechRecognition?: unknown;
        }
      ).SpeechRecognition ??
      (window as unknown as { webkitSpeechRecognition?: unknown })
        .webkitSpeechRecognition,
    );

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) reset();
      }}
    >
      <DialogContent className="flex max-h-[92dvh] w-[calc(100vw-1rem)] max-w-lg flex-col gap-0 overflow-hidden p-0 sm:w-full">
        <DialogHeader className="shrink-0 border-b border-border px-4 py-3 pr-10 sm:px-6">
          <DialogTitle className="uppercase tracking-wide">
            Quick capture
          </DialogTitle>
          <DialogDescription>
            Record it now, structure it later. Quick captures can be converted
            into full observations.
          </DialogDescription>
        </DialogHeader>
        <div className="grid flex-1 gap-3 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6">
          <div className="grid gap-1.5">
            <div className="flex items-center justify-between">
              <Label className="eyebrow">Note</Label>
              {speechAvailable ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={dictate}
                  disabled={listening}
                >
                  {listening ? "Listening…" : "Voice to text"}
                </Button>
              ) : null}
            </div>
            <Textarea
              rows={4}
              value={note}
              maxLength={4000}
              className="text-base"
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Area" value={area} onChange={setArea} />
            <Field label="Machine" value={machine} onChange={setMachine} />
          </div>
          <Field
            label="Potential problem"
            value={problem}
            onChange={setProblem}
          />
          <TagPicker
            label="Capability domain"
            single
            options={FIELD_DOMAINS.map((d) => d.title)}
            selected={domain ? [domainByCode(domain)?.title ?? ""] : []}
            onChange={(v) =>
              setDomain(
                FIELD_DOMAINS.find((d) => d.title === v[0])?.code ?? null,
              )
            }
          />
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileRef.current?.click()}
            >
              <Camera className="size-4" aria-hidden /> Photo
            </Button>
            {photo ? (
              <span className="truncate text-xs text-muted-foreground">
                {photo.name}
              </span>
            ) : null}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
            />
          </div>
        </div>
        <DialogFooter className="shrink-0 border-t border-border bg-background px-4 py-3 sm:px-6">
          <Button
            disabled={saving || (!note.trim() && !problem.trim())}
            onClick={() => {
              onSave({
                note,
                area,
                machine,
                domain_code: domain,
                potential_problem: problem,
                photo,
              });
              reset();
            }}
          >
            <Zap className="size-4" aria-hidden /> Save capture
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------- evidence -------------------------------- */

export function EvidenceThumb({
  row,
  onDelete,
}: {
  row: FieldAttachmentRow;
  onDelete?: () => void;
}) {
  const { data: url } = useEvidenceUrl(row.storage_path);
  const isImage = /\.(png|jpe?g|webp|gif|heic)$/i.test(
    row.file_name ?? row.storage_path,
  );
  return (
    <figure className="relative w-28 shrink-0 overflow-hidden rounded-sm border border-border">
      {isImage && url ? (
        <img
          src={url}
          alt={row.caption ?? row.file_name ?? "Field evidence"}
          loading="lazy"
          className="h-20 w-full object-cover"
        />
      ) : (
        <a
          href={url ?? "#"}
          target="_blank"
          rel="noreferrer"
          className="flex h-20 w-full items-center justify-center bg-muted text-muted-foreground"
        >
          <Paperclip className="size-5" aria-hidden />
        </a>
      )}
      <figcaption className="truncate px-1.5 py-1 text-[10px] text-muted-foreground">
        {row.caption || row.file_name || "Evidence"}
      </figcaption>
      {onDelete ? (
        <button
          type="button"
          aria-label="Remove evidence"
          onClick={onDelete}
          className="absolute right-1 top-1 rounded-sm bg-background/85 p-1 text-muted-foreground hover:text-critical"
        >
          <X className="size-3" aria-hidden />
        </button>
      ) : null}
    </figure>
  );
}

export function EvidenceStrip({
  rows,
  onUpload,
  onDelete,
  uploading,
}: {
  rows: FieldAttachmentRow[];
  onUpload: (file: File) => void;
  onDelete?: (row: FieldAttachmentRow) => void;
  uploading?: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Camera className="size-4" aria-hidden />
          )}
          Add photo / document
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*,application/pdf"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onUpload(f);
            e.target.value = "";
          }}
        />
      </div>
      {rows.length ? (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {rows.map((r) => (
            <EvidenceThumb
              key={r.id}
              row={r}
              onDelete={onDelete ? () => onDelete(r) : undefined}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------ severity chip ----------------------------- */

export const severityToken: Record<string, string> = {
  Critical: "text-critical border-critical/50 bg-critical/10",
  High: "text-high border-high/50 bg-high/10",
  Moderate: "text-medium border-medium/50 bg-medium/10",
  Low: "text-muted-foreground border-border",
};

export function Chip({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm border border-border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground",
        className,
      )}
    >
      {label}
    </span>
  );
}

export function ObservationCard({
  row,
  attachments,
  onEdit,
  onDelete,
  onCreateGap,
  hasGap,
}: {
  row: FieldCaptureObservationRow;
  attachments: FieldAttachmentRow[];
  onEdit: () => void;
  onDelete: () => void;
  onCreateGap: () => void;
  hasGap: boolean;
}) {
  const location = [row.area, row.machine, row.production_cell, row.process]
    .filter(Boolean)
    .join(" / ");
  return (
    <article className="rounded-sm border border-border p-4">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="min-w-0">
          <p className="eyebrow">
            {domainByCode(row.domain_code)?.title ?? "Observation"}
          </p>
          <h3 className="truncate text-sm font-semibold text-foreground">
            {row.category ||
              row.observed_condition?.slice(0, 60) ||
              "Observation"}
          </h3>
          {location ? (
            <p className="truncate text-xs text-muted-foreground">{location}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="metric text-lg font-semibold text-foreground">
            {row.not_observed ? "N/O" : (row.rating ?? "—")}
          </span>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Delete observation"
            onClick={onDelete}
          >
            <Trash2 className="size-4" aria-hidden />
          </Button>
        </div>
      </div>
      {row.observed_condition ? (
        <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">
          {row.observed_condition}
        </p>
      ) : null}
      {row.objective_evidence ? (
        <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">
          <span className="font-semibold uppercase tracking-widest">
            Evidence —{" "}
          </span>
          {row.objective_evidence}
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <Chip label={row.evidence_class} />
        {row.context_source ? <Chip label={row.context_source} /> : null}
      </div>
      {attachments.length ? (
        <div className="mt-3 flex gap-2 overflow-x-auto">
          {attachments.map((a) => (
            <EvidenceThumb key={a.id} row={a} />
          ))}
        </div>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={onEdit}>
          Edit
        </Button>
        <Button
          size="sm"
          variant={hasGap ? "ghost" : "default"}
          onClick={onCreateGap}
          disabled={hasGap}
        >
          {hasGap ? "Gap created" : "Create capability gap"}
        </Button>
      </div>
    </article>
  );
}

export const GAP_PICKERS = {
  impacts: PRODUCTION_IMPACT_OPTIONS,
  severity: GAP_SEVERITY,
  actions: IRONCLAD_ACTIONS,
};
