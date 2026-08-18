import { useMemo, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { Building2, Plus } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/ironiq/layout-primitives";
import { Tag } from "@/components/ironiq/badges";
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

export const Route = createFileRoute("/_authenticated/business-development/")({
  head: () => ({
    meta: [{ title: "Business Development — IronIQ" }],
  }),
  component: BusinessDevelopmentPage,
});

function formatValue(v: string | null): string | null {
  if (v === null) return null;
  const n = Number(v);
  if (Number.isNaN(n)) return null;
  return n >= 1000 ? `$${(n / 1000).toFixed(0)}k` : `$${n.toFixed(0)}`;
}

function BusinessDevelopmentPage() {
  const prospects = useProspects();
  const byStage = useMemo(() => {
    const map = new Map<ProspectStage, Prospect[]>();
    for (const s of STAGES) map.set(s.key, []);
    for (const p of prospects.data ?? []) {
      map.get(p.stage)?.push(p);
    }
    return map;
  }, [prospects.data]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        eyebrow="Internal — IronIQ staff only"
        title="Business Development"
        description="Track prospective customers and the status of potential business, from first contact through close."
        actions={<NewProspectDialog />}
      />

      {prospects.isLoading ? (
        <EmptyState message="Loading…" />
      ) : (prospects.data ?? []).length === 0 ? (
        <EmptyState message="No prospects yet — add the first one to start tracking the pipeline." />
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-2">
          {STAGES.map((s) => (
            <div key={s.key} className="w-64 shrink-0 space-y-3">
              <div className="flex items-center justify-between px-1">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                  {s.label}
                </p>
                <span className="text-xs text-muted-foreground">
                  {byStage.get(s.key)?.length ?? 0}
                </span>
              </div>
              <div className="space-y-2">
                {(byStage.get(s.key) ?? []).map((p) => (
                  <ProspectCard key={p.id} prospect={p} />
                ))}
                {(byStage.get(s.key) ?? []).length === 0 ? (
                  <p className="rounded-md border border-dashed border-border p-3 text-center text-xs text-muted-foreground">
                    Empty
                  </p>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ProspectCard({ prospect: p }: { prospect: Prospect }) {
  const save = useSaveProspect();

  return (
    <div className="rounded-md border border-border p-3 transition-colors hover:border-primary/50 hover:bg-muted/20">
      <Link
        to="/business-development/$prospectId"
        params={{ prospectId: p.id }}
        className="block"
      >
        <div className="flex items-start gap-2">
          <Building2
            className="mt-0.5 size-3.5 shrink-0 text-muted-foreground"
            aria-hidden
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">
              {p.company_name}
            </p>
            {p.industry ? (
              <p className="truncate text-xs text-muted-foreground">
                {p.industry}
              </p>
            ) : null}
          </div>
        </div>
        {formatValue(p.estimated_value) ? (
          <p className="mt-2 text-xs font-medium text-primary">
            {formatValue(p.estimated_value)}
          </p>
        ) : null}
      </Link>
      {/* Sibling to the Link above, not nested inside it — a Select
          trigger inside an anchor risks the click bubbling into
          navigation instead of opening the dropdown. This is what
          actually makes stage editable straight from the pipeline,
          not just from the full edit dialog. */}
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
        <SelectTrigger className="mt-2 h-7 text-xs">
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
    </div>
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
            and meetings from its page.
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
