import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  FIELD_SCALE,
  sectionResult,
  type FieldObservationRow,
  type FieldSection,
} from "@/lib/field-form";

/** Text field that persists on blur so shop-floor entry never needs a Save tap. */
export function AutoField({
  label,
  value,
  onCommit,
  multiline,
  placeholder,
  disabled,
  rows = 3,
  required,
}: {
  label?: string;
  value: string | null | undefined;
  onCommit: (v: string) => void;
  multiline?: boolean;
  placeholder?: string;
  disabled?: boolean;
  rows?: number;
  /** Blocks committing an empty value and shows an inline message. */
  required?: boolean;
}) {
  const [text, setText] = useState(value ?? "");
  const [error, setError] = useState<string | null>(null);
  const fieldId = useId();
  const focused = useRef(false);
  // A background refetch must never wipe what someone is typing on the floor.
  useEffect(() => {
    if (!focused.current) setText(value ?? "");
  }, [value]);
  const commit = () => {
    focused.current = false;
    if (required && text.trim() === "") {
      setError(`${label ?? "This field"} is required.`);
      setText(value ?? "");
      return;
    }
    setError(null);
    if ((value ?? "") !== text) onCommit(text);
  };
  const describedBy = error ? `${fieldId}-error` : undefined;
  return (
    <div className="grid gap-1.5">
      {label ? (
        <Label htmlFor={fieldId} className="eyebrow">
          {label}
          {required ? <span aria-hidden> *</span> : null}
        </Label>
      ) : null}
      {multiline ? (
        <Textarea
          id={fieldId}
          value={text}
          rows={rows}
          disabled={disabled}
          placeholder={placeholder}
          maxLength={4000}
          required={required}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => {
            focused.current = true;
          }}
          onBlur={commit}
          className="text-base"
        />
      ) : (
        <Input
          id={fieldId}
          value={text}
          disabled={disabled}
          placeholder={placeholder}
          maxLength={300}
          required={required}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => {
            focused.current = true;
          }}
          onBlur={commit}
          className="h-11 text-base"
        />
      )}
      {error ? (
        <p id={`${fieldId}-error`} className="text-xs text-critical">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function TagPicker({
  label,
  options,
  selected,
  onChange,
  disabled,
  single,
}: {
  label?: string;
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  single?: boolean;
}) {
  const toggle = (opt: string) => {
    if (single) {
      onChange(selected.includes(opt) ? [] : [opt]);
      return;
    }
    onChange(
      selected.includes(opt)
        ? selected.filter((s) => s !== opt)
        : [...selected, opt],
    );
  };
  return (
    <div className="grid gap-1.5">
      {label ? <Label className="eyebrow">{label}</Label> : null}
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            disabled={disabled}
            onClick={() => toggle(opt)}
            className={cn(
              "min-h-9 rounded-sm border px-3 py-1.5 text-left text-xs font-semibold uppercase tracking-wide transition-colors",
              selected.includes(opt)
                ? "border-primary bg-primary/10 text-foreground"
                : "border-border text-muted-foreground hover:border-primary/60 hover:text-foreground",
              disabled && "opacity-50",
            )}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

const scoreTone = (score: number | null) =>
  score === null
    ? "text-muted-foreground"
    : score >= 4.5
      ? "text-success"
      : score >= 3.5
        ? "text-medium"
        : score >= 2.5
          ? "text-high"
          : "text-critical";

export function RatingRow({
  label,
  row,
  disabled,
  onChange,
}: {
  label: string;
  row: FieldObservationRow | undefined;
  disabled?: boolean;
  onChange: (values: {
    rating?: number | null;
    not_observed?: boolean;
    notes?: string | null;
  }) => void;
}) {
  const [noteOpen, setNoteOpen] = useState(Boolean(row?.notes));
  const no = row?.not_observed ?? false;
  return (
    <div className="border-t border-border py-3 first:border-t-0">
      <p className="text-sm font-medium text-foreground">{label}</p>
      <div className="mt-2 grid grid-cols-6 gap-1.5">
        {FIELD_SCALE.map((s) => (
          <button
            key={s.value}
            type="button"
            disabled={no || disabled}
            title={`${s.label} — ${s.description}`}
            onClick={() =>
              onChange({
                rating: row?.rating === s.value ? null : s.value,
                not_observed: false,
              })
            }
            className={cn(
              "flex h-12 flex-col items-center justify-center rounded-sm border font-display text-base font-semibold transition-colors",
              row?.rating === s.value && !no
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-muted-foreground hover:border-primary/60 hover:text-foreground",
              (no || disabled) && "opacity-40",
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
          onClick={() => onChange({ not_observed: !no, rating: null })}
          className={cn(
            "h-12 rounded-sm border font-display text-xs font-semibold uppercase transition-colors",
            no
              ? "border-primary bg-primary/15 text-foreground"
              : "border-border text-muted-foreground hover:text-foreground",
          )}
        >
          N/O
        </button>
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setNoteOpen((v) => !v)}
        className="mt-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground"
      >
        {row?.notes ? "Edit field note" : "Add field note / evidence"}
      </button>
      {noteOpen ? (
        <div className="mt-2">
          <AutoField
            value={row?.notes ?? ""}
            disabled={disabled}
            rows={2}
            multiline
            placeholder="What did you see, hear or measure?"
            onCommit={(notes) => onChange({ notes })}
          />
        </div>
      ) : null}
    </div>
  );
}

export function SectionPanel({
  section,
  rows,
  disabled,
  onChange,
  findings,
  onFindings,
}: {
  section: FieldSection;
  rows: FieldObservationRow[];
  disabled?: boolean;
  onChange: (
    areaCode: string,
    values: {
      rating?: number | null;
      not_observed?: boolean;
      notes?: string | null;
    },
  ) => void;
  findings?: string | null;
  onFindings?: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const result = sectionResult(section, rows);
  const byArea = new Map(rows.map((r) => [r.area_code, r]));

  return (
    <section className="panel overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-4 text-left"
      >
        <div className="min-w-0">
          <p className="eyebrow">Section {section.number}</p>
          <h2 className="truncate text-sm font-semibold uppercase tracking-wider text-foreground">
            {section.title}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {section.question}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <div className="text-right">
            <p
              className={cn(
                "metric text-xl font-semibold",
                scoreTone(result.score),
              )}
            >
              {result.score === null ? "—" : result.score.toFixed(1)}
            </p>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
              {result.rated}/{result.total}
            </p>
          </div>
          <ChevronDown
            className={cn("size-4 transition-transform", open && "rotate-180")}
            aria-hidden
          />
        </div>
      </button>

      {open ? (
        <div className="border-t border-border px-4 pb-4">
          <div className="pt-1">
            {section.areas.map((a) => (
              <RatingRow
                key={a.code}
                label={a.label}
                row={byArea.get(a.code)}
                disabled={disabled}
                onChange={(v) => onChange(a.code, v)}
              />
            ))}
          </div>

          {section.keyQuestions.length ? (
            <div className="mt-4 rounded-sm border border-dashed border-border p-3">
              <p className="eyebrow">Key questions</p>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-muted-foreground">
                {section.keyQuestions.map((q) => (
                  <li key={q}>{q}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {section.lookFor?.length ? (
            <div className="mt-3 rounded-sm border border-dashed border-border p-3">
              <p className="eyebrow">Look for</p>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-muted-foreground">
                {section.lookFor.map((q) => (
                  <li key={q}>{q}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {onFindings ? (
            <div className="mt-4">
              <AutoField
                label="Significant findings"
                value={findings ?? ""}
                multiline
                disabled={disabled}
                onCommit={onFindings}
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

export function EntryCard({
  title,
  onDelete,
  disabled,
  children,
}: {
  title: string;
  onDelete?: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-sm border border-border p-4">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <p className="truncate font-display text-xs font-semibold uppercase tracking-widest text-foreground">
          {title}
        </p>
        {onDelete ? (
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Remove ${title}`}
            disabled={disabled}
            onClick={onDelete}
          >
            <Trash2 className="size-4" aria-hidden />
          </Button>
        ) : null}
      </div>
      <div className="mt-3 grid gap-3">{children}</div>
    </div>
  );
}
