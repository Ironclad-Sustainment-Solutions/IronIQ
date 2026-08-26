import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Pencil } from "lucide-react";
import {
  PageHeader,
  Panel,
  EmptyState,
} from "@/components/ironiq/layout-primitives";
import { Tag } from "@/components/ironiq/badges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
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
  useCncChangeLog,
  useCreateCncLogEntry,
  useVerifyCncLogEntry,
  useDeleteCncLogEntry,
  useUpdateCncLogEntry,
  type CncChangeCategory,
  type CncChangeLogRow,
} from "@/lib/cnc-api";
import { useDraftFromPrecedent } from "@/lib/precedent-draft-api";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/cnc")({
  head: () => ({
    meta: [
      { title: "CNC Coding Enhancement — IronIQ" },
      {
        name: "description",
        content:
          "Log CNC program and machine changes, verify outcomes, and build a searchable history of what's actually worked.",
      },
      { property: "og:title", content: "CNC Coding Enhancement — IronIQ" },
      {
        property: "og:description",
        content: "Change logging for CNC programs and machine parameters.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CncChangeLogPage,
});

const CATEGORY_LABELS: Record<CncChangeCategory, string> = {
  feed_speed: "Feed / Speed",
  toolpath: "Toolpath",
  fixture: "Fixture",
  tooling: "Tooling",
  program_logic: "Program logic",
  other: "Other",
};

function CncChangeLogPage() {
  const { organization } = useApp();
  const entries = useCncChangeLog(organization?.id).data ?? [];
  const create = useCreateCncLogEntry(organization?.id);
  const draftAI = useDraftFromPrecedent();

  const [machineName, setMachineName] = useState("");
  const [programIdentifier, setProgramIdentifier] = useState("");
  const [category, setCategory] = useState<CncChangeCategory>("feed_speed");
  const [changeDescription, setChangeDescription] = useState("");
  const [reason, setReason] = useState("");

  const [verifyingId, setVerifyingId] = useState<string | null>(null);

  if (!organization) {
    return (
      <div className="mx-auto max-w-5xl space-y-8">
        <PageHeader
          eyebrow="CNC Coding Enhancement"
          title="CNC Coding Enhancement"
        />
        <EmptyState message="Select an organization first." />
      </div>
    );
  }

  const handleLog = () => {
    if (!machineName.trim() || !changeDescription.trim() || !reason.trim())
      return;
    create.mutate(
      {
        machineName,
        programIdentifier: programIdentifier || undefined,
        changeCategory: category,
        changeDescription,
        reason,
      },
      {
        onSuccess: () => {
          setMachineName("");
          setProgramIdentifier("");
          setChangeDescription("");
          setReason("");
        },
      },
    );
  };

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <PageHeader
        eyebrow={organization.name}
        title="CNC Coding Enhancement"
        description="Log a change as soon as you make it — machine, what changed, and why. Come back later to record the outcome once you actually know it. The more of these that get logged and verified, the more precedent Ask IronIQ has to draw on."
      />

      <Panel
        title="1. Log a change"
        subtitle="Keep this quick — outcome comes later, at verification"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            placeholder="Machine (e.g. Haas VF-4 #3)"
            value={machineName}
            onChange={(e) => setMachineName(e.target.value)}
          />
          <Input
            placeholder="Program # (optional)"
            value={programIdentifier}
            onChange={(e) => setProgramIdentifier(e.target.value)}
          />
          <Select
            value={category}
            onValueChange={(v) => setCategory(v as CncChangeCategory)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div />
          <div className="sm:col-span-2">
            <Textarea
              placeholder="What changed (e.g. reduced feed rate 15% on roughing pass)"
              rows={2}
              value={changeDescription}
              onChange={(e) => setChangeDescription(e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <Textarea
              placeholder="Why (e.g. chatter on thin-wall aluminum bracket)"
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <div className="mt-1.5 flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={!reason.trim() || draftAI.isPending}
                onClick={() =>
                  draftAI.mutate(
                    {
                      problemDescription: reason,
                      fieldLabel: "fix or machine/program change",
                    },
                    {
                      onSuccess: (result) => {
                        if (result.draft) {
                          setChangeDescription(result.draft);
                        } else {
                          toast.info(
                            "No closely-matching precedent found for this yet.",
                          );
                        }
                      },
                    },
                  )
                }
              >
                {draftAI.isPending
                  ? "Checking precedent…"
                  : "Draft what changed from precedent"}
              </Button>
              {draftAI.data?.draft ? (
                <span className="text-xs text-muted-foreground">
                  AI-drafted from {draftAI.data.patterns.length} pattern
                  {draftAI.data.patterns.length === 1 ? "" : "s"} — review
                  before saving
                </span>
              ) : null}
            </div>
            {draftAI.data?.patterns.length ? (
              <Collapsible className="mt-1.5">
                <CollapsibleTrigger asChild>
                  <Button type="button" variant="link" size="sm" className="h-auto p-0 text-xs">
                    View matched patterns
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2 space-y-2">
                  {draftAI.data.patterns.map((p, i) => (
                    <div key={p.id} className="rounded border border-border p-2 text-xs">
                      <p className="font-medium text-foreground">
                        Pattern {i + 1} — {p.category_label ?? "unspecified industry"} ·{" "}
                        {p.origin === "reference_library"
                          ? "curated reference pattern"
                          : "from a past engagement"}
                      </p>
                      <p className="mt-1 text-muted-foreground">{p.pattern_summary}</p>
                      {p.pattern_resolution ? (
                        <p className="mt-1 text-muted-foreground">
                          Resolution: {p.pattern_resolution}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </CollapsibleContent>
              </Collapsible>
            ) : null}
          </div>
        </div>
        <div className="mt-3">
          <Button onClick={handleLog} disabled={create.isPending}>
            Log change
          </Button>
        </div>
      </Panel>

      <Panel
        title="2. History"
        subtitle={`${entries.length} entr${entries.length === 1 ? "y" : "ies"}`}
      >
        {entries.length === 0 ? (
          <EmptyState message="No changes logged yet." />
        ) : (
          <div className="space-y-3">
            {entries.map((entry) => (
              <ChangeLogRow
                key={entry.id}
                entry={entry}
                isVerifying={verifyingId === entry.id}
                onStartVerify={() => setVerifyingId(entry.id)}
                onCancelVerify={() => setVerifyingId(null)}
                organizationId={organization.id}
              />
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

function ChangeLogRow({
  entry,
  isVerifying,
  onStartVerify,
  onCancelVerify,
  organizationId,
}: {
  entry: CncChangeLogRow;
  isVerifying: boolean;
  onStartVerify: () => void;
  onCancelVerify: () => void;
  organizationId: string;
}) {
  const verify = useVerifyCncLogEntry(organizationId);
  const remove = useDeleteCncLogEntry(organizationId);
  const update = useUpdateCncLogEntry(organizationId);
  const [outcome, setOutcome] = useState("");
  const [contribute, setContribute] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({
    machineName: entry.machine_name,
    programIdentifier: entry.program_identifier ?? "",
    changeCategory: entry.change_category,
    changeDescription: entry.change_description,
    reason: entry.reason,
  });

  if (editing) {
    return (
      <div className="rounded-md border border-border p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            value={draft.machineName}
            onChange={(e) =>
              setDraft((d) => ({ ...d, machineName: e.target.value }))
            }
            placeholder="Machine"
          />
          <Input
            value={draft.programIdentifier}
            onChange={(e) =>
              setDraft((d) => ({ ...d, programIdentifier: e.target.value }))
            }
            placeholder="Program # (optional)"
          />
          <Select
            value={draft.changeCategory}
            onValueChange={(v) =>
              setDraft((d) => ({
                ...d,
                changeCategory: v as CncChangeCategory,
              }))
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div />
          <div className="sm:col-span-2">
            <Textarea
              rows={2}
              value={draft.changeDescription}
              onChange={(e) =>
                setDraft((d) => ({ ...d, changeDescription: e.target.value }))
              }
            />
          </div>
          <div className="sm:col-span-2">
            <Textarea
              rows={2}
              value={draft.reason}
              onChange={(e) =>
                setDraft((d) => ({ ...d, reason: e.target.value }))
              }
            />
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <Button
            size="sm"
            disabled={
              update.isPending ||
              !draft.machineName.trim() ||
              !draft.changeDescription.trim() ||
              !draft.reason.trim()
            }
            onClick={() =>
              update.mutate(
                {
                  id: entry.id,
                  ...draft,
                  programIdentifier: draft.programIdentifier || undefined,
                },
                { onSuccess: () => setEditing(false) },
              )
            }
          >
            Save
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Tag token="steel">{CATEGORY_LABELS[entry.change_category]}</Tag>
            <span className="text-xs text-muted-foreground">
              {entry.machine_name}
              {entry.program_identifier ? ` · ${entry.program_identifier}` : ""}
            </span>
          </div>
          <p className="mt-1 text-sm text-foreground">
            {entry.change_description}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Reason: {entry.reason}
          </p>
          {entry.outcome_description ? (
            <p className="mt-1 text-xs text-success">
              Outcome: {entry.outcome_description}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Tag token={entry.status === "verified" ? "success" : "steel"}>
            {entry.status}
          </Tag>
          {entry.status === "logged" && !isVerifying ? (
            <Button size="sm" variant="outline" onClick={onStartVerify}>
              Verify
            </Button>
          ) : null}
          <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
            <Pencil className="size-3.5" aria-hidden /> Edit
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => remove.mutate(entry.id)}
          >
            Remove
          </Button>
        </div>
      </div>

      {isVerifying ? (
        <div className="mt-4 space-y-3 border-t border-border pt-4">
          <Textarea
            placeholder="What actually happened (e.g. cycle time down from 145s to 128s, chatter eliminated)"
            rows={2}
            value={outcome}
            onChange={(e) => setOutcome(e.target.value)}
          />
          <div className="flex items-start gap-2 rounded-md border border-border bg-muted/20 p-3">
            <Checkbox
              id={`contribute-cnc-${entry.id}`}
              checked={contribute}
              onCheckedChange={(v) => setContribute(v === true)}
            />
            <Label
              htmlFor={`contribute-cnc-${entry.id}`}
              className="text-xs font-normal text-muted-foreground"
            >
              Contribute an anonymized version of this resolution to the IronIQ
              Intelligence Layer, to help other shops with similar problems.
              Nothing identifying is shared, and it's reviewed before it's ever
              visible to anyone else.
            </Label>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={!outcome.trim() || verify.isPending}
              onClick={() =>
                verify.mutate(
                  {
                    id: entry.id,
                    outcomeDescription: outcome,
                    contributeToIntelligence: contribute,
                  },
                  { onSuccess: onCancelVerify },
                )
              }
            >
              Save outcome
            </Button>
            <Button size="sm" variant="ghost" onClick={onCancelVerify}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
