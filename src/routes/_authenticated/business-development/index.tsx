import { useMemo, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import {
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  ChevronRight,
  Plus,
} from "lucide-react";
import {
  PageHeader,
  Panel,
  EmptyState,
} from "@/components/ironiq/layout-primitives";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useProspects,
  useSaveProspect,
  STAGES,
  type Prospect,
  type ProspectStage,
} from "@/lib/business-development-api";

export const Route = createFileRoute("/_authenticated/business-development/")({
  head: () => ({
    meta: [{ title: "Business Development — IronIQ" }],
  }),
  component: BusinessDevelopmentPage,
});

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

function formatValue(v: string | null): string | null {
  if (v === null) return null;
  const n = Number(v);
  if (Number.isNaN(n)) return null;
  return n >= 1000 ? `$${(n / 1000).toFixed(0)}k` : `$${n.toFixed(0)}`;
}

function formatDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

type SortKey =
  | "company_name"
  | "estimated_value"
  | "expected_close_date"
  | "last_interaction_at"
  | "updated_at";

const COLUMNS: { key: SortKey; label: string; align?: "right" }[] = [
  { key: "company_name", label: "Company" },
  { key: "estimated_value", label: "Value", align: "right" },
  { key: "expected_close_date", label: "Expected Close" },
  { key: "last_interaction_at", label: "Last Interaction" },
  { key: "updated_at", label: "Updated" },
];

function BusinessDevelopmentPage() {
  const prospects = useProspects();
  const [selectedStage, setSelectedStage] = useState<ProspectStage>("lead");
  const [sortKey, setSortKey] = useState<SortKey>("updated_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const counts = useMemo(() => {
    const map = new Map<ProspectStage, number>();
    for (const s of STAGES) map.set(s.key, 0);
    for (const p of prospects.data ?? []) {
      map.set(p.stage, (map.get(p.stage) ?? 0) + 1);
    }
    return map;
  }, [prospects.data]);

  const rows = useMemo(() => {
    const filtered = (prospects.data ?? []).filter(
      (p) => p.stage === selectedStage,
    );
    const dir = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (sortKey === "estimated_value") {
        const av = a.estimated_value ? Number(a.estimated_value) : -Infinity;
        const bv = b.estimated_value ? Number(b.estimated_value) : -Infinity;
        return (av - bv) * dir;
      }
      if (sortKey === "company_name") {
        return a.company_name.localeCompare(b.company_name) * dir;
      }
      // Date-shaped columns (expected_close_date, last_interaction_at, updated_at) — nulls sort last regardless of direction.
      const av = a[sortKey];
      const bv = b[sortKey];
      if (!av && !bv) return 0;
      if (!av) return 1;
      if (!bv) return -1;
      return (new Date(av).getTime() - new Date(bv).getTime()) * dir;
    });
  }, [prospects.data, selectedStage, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "company_name" ? "asc" : "desc");
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        eyebrow="Internal — IronIQ staff only"
        title="Business Development"
        description="Track prospective customers and the status of potential business, from first contact through close."
        actions={<NewProspectDialog />}
      />

      {/* Stage selector — one stage in view at a time, not a wall of
          scrolling columns. Counts make the whole pipeline's shape
          scannable at a glance without needing every stage on screen
          simultaneously. */}
      <div className="flex gap-1 border-b border-border">
        {STAGES.map((s) => {
          const active = s.key === selectedStage;
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => setSelectedStage(s.key)}
              className={cnTab(active)}
            >
              {s.label}
              <span
                className={
                  active
                    ? "ml-2 rounded-full bg-primary/20 px-2 py-0.5 text-xs font-semibold text-primary"
                    : "ml-2 rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground"
                }
              >
                {counts.get(s.key) ?? 0}
              </span>
            </button>
          );
        })}
      </div>

      {prospects.isLoading ? (
        <EmptyState message="Loading…" />
      ) : rows.length === 0 ? (
        <EmptyState
          message={
            (prospects.data ?? []).length === 0
              ? "No prospects yet — add the first one to start tracking the pipeline."
              : `No prospects in ${STAGES.find((s) => s.key === selectedStage)?.label}.`
          }
        />
      ) : (
        <Panel>
          <div className="-mx-5 -my-5 overflow-x-auto">
            <table className="w-full min-w-[52rem] text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  {COLUMNS.map((col) => (
                    <th
                      key={col.key}
                      className={
                        col.align === "right"
                          ? "px-5 py-3 text-right"
                          : "px-5 py-3"
                      }
                    >
                      <button
                        type="button"
                        onClick={() => toggleSort(col.key)}
                        className={
                          "eyebrow inline-flex items-center gap-1 font-semibold hover:text-foreground" +
                          (col.align === "right" ? " flex-row-reverse" : "")
                        }
                      >
                        {col.label}
                        {sortKey === col.key ? (
                          sortDir === "asc" ? (
                            <ArrowUp className="size-3" aria-hidden />
                          ) : (
                            <ArrowDown className="size-3" aria-hidden />
                          )
                        ) : (
                          <ArrowUpDown
                            className="size-3 opacity-40"
                            aria-hidden
                          />
                        )}
                      </button>
                    </th>
                  ))}
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((p) => (
                  <ProspectRow key={p.id} prospect={p} />
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </div>
  );
}

function cnTab(active: boolean): string {
  return (
    "relative px-4 py-3 text-sm font-semibold uppercase tracking-wide transition-colors " +
    (active
      ? "text-primary after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:bg-primary"
      : "text-muted-foreground hover:text-foreground")
  );
}

function ProspectRow({ prospect: p }: { prospect: Prospect }) {
  const save = useSaveProspect();

  return (
    <tr className="transition-colors hover:bg-accent/40">
      <td className="px-5 py-4">
        <Link
          to="/business-development/$prospectId"
          params={{ prospectId: p.id }}
          className="font-medium text-foreground underline-offset-4 hover:text-primary hover:underline"
        >
          {p.company_name}
        </Link>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {p.industry ?? "No industry set"} · {p.note_count} note
          {p.note_count === "1" ? "" : "s"} · {p.interaction_count} interaction
          {p.interaction_count === "1" ? "" : "s"}
        </p>
      </td>
      <td className="metric px-5 py-4 text-right font-semibold">
        {formatValue(p.estimated_value) ?? "—"}
      </td>
      <td className="metric px-5 py-4 text-muted-foreground">
        {formatDate(p.expected_close_date)}
      </td>
      <td className="metric px-5 py-4 text-muted-foreground">
        {formatDate(p.last_interaction_at)}
      </td>
      <td className="metric px-5 py-4 text-muted-foreground">
        {formatDate(p.updated_at)}
      </td>
      <td className="px-5 py-4">
        <div className="flex items-center justify-end gap-2">
          <Select
            value={p.stage}
            onValueChange={(v) =>
              save.mutate({
                id: p.id,
                company_name: p.company_name,
                industry: p.industry,
                stage: v as ProspectStage,
                estimated_value: p.estimated_value
                  ? Number(p.estimated_value)
                  : null,
                expected_close_date: p.expected_close_date,
                lost_reason: p.lost_reason,
              })
            }
          >
            <SelectTrigger className="h-8 w-40 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STAGES.map((s) => (
                <SelectItem key={s.key} value={s.key}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Link
            to="/business-development/$prospectId"
            params={{ prospectId: p.id }}
          >
            <ChevronRight
              className="size-4 text-muted-foreground"
              aria-hidden
            />
          </Link>
        </div>
      </td>
    </tr>
  );
}

function NewProspectDialog() {
  const [open, setOpen] = useState(false);
  const save = useSaveProspect();
  const [form, setForm] = useState({
    company_name: "",
    industry: "",
    stage: "lead" as ProspectStage,
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="size-4" aria-hidden /> New Prospect
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New prospect</DialogTitle>
          <DialogDescription>
            Start tracking a potential customer — you can add contacts, notes,
            and interactions from its page.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Field label="Company name">
            <Input
              value={form.company_name}
              onChange={(e) =>
                setForm((f) => ({ ...f, company_name: e.target.value }))
              }
              autoFocus
            />
          </Field>
          <Field label="Industry">
            <Input
              value={form.industry}
              onChange={(e) =>
                setForm((f) => ({ ...f, industry: e.target.value }))
              }
              placeholder="e.g. aerospace, automotive"
            />
          </Field>
          <Field label="Stage">
            <Select
              value={form.stage}
              onValueChange={(v) =>
                setForm((f) => ({ ...f, stage: v as ProspectStage }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STAGES.map((s) => (
                  <SelectItem key={s.key} value={s.key}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
        <DialogFooter>
          <Button
            disabled={save.isPending || !form.company_name.trim()}
            onClick={() =>
              save.mutate(
                {
                  company_name: form.company_name,
                  industry: form.industry || null,
                  stage: form.stage,
                },
                {
                  onSuccess: () => {
                    setOpen(false);
                    setForm({ company_name: "", industry: "", stage: "lead" });
                  },
                },
              )
            }
          >
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
