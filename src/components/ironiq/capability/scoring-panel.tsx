import { useState } from "react";
import { Panel } from "@/components/ironiq/layout-primitives";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tag } from "@/components/ironiq/badges";
import { ScoreChip, Meter } from "./shared";
import {
  DIMENSIONS,
  MATURITY_SCALE,
  type CapCriterionRow,
  type CapDimension,
  type CapDomainRow,
  type CapScoreRow,
} from "@/lib/capability-domain";
import {
  computeCapability,
  scoreToken,
  type CriterionResult,
} from "@/lib/capability-scoring";
import { useSaveCapScore } from "@/lib/capability-api";
import { cn } from "@/lib/utils";
import { AlertTriangle, ChevronDown } from "lucide-react";

export function ScoringPanel({
  assessmentId,
  domains,
  criteria,
  scores,
}: {
  assessmentId: string;
  domains: CapDomainRow[];
  criteria: CapCriterionRow[];
  scores: CapScoreRow[];
}) {
  const result = computeCapability(domains, criteria, scores);
  const [openDomain, setOpenDomain] = useState<string | null>(
    domains[0]?.id ?? null,
  );

  return (
    <div className="grid gap-6">
      <Panel
        title="Performance Scale"
        subtitle="Score how well the capability performs in this operating environment — not whether it exists."
      >
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {MATURITY_SCALE.map((s) => (
            <div key={s.value} className="rounded-md border border-border p-3">
              <div className="flex items-center gap-2">
                <ScoreChip score={s.value} size="sm" />
                <span className="font-display text-sm font-semibold uppercase tracking-widest">
                  {s.label}
                </span>
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">
                {s.description}
              </p>
            </div>
          ))}
        </div>
      </Panel>

      {result.domains.map((d) => {
        const open = openDomain === d.domain.id;
        return (
          <section key={d.domain.id} className="panel">
            <button
              type="button"
              onClick={() => setOpenDomain(open ? null : d.domain.id)}
              className="flex w-full items-center gap-4 border-b border-border px-5 py-4 text-left"
            >
              <div className="min-w-0 flex-1">
                <p className="eyebrow">{d.domain.verb}</p>
                <h2 className="text-base font-semibold uppercase tracking-wider text-foreground">
                  {d.domain.name}
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {d.domain.key_question}
                </p>
              </div>
              <div className="hidden w-40 shrink-0 sm:block">
                <Meter value={d.percent} token={scoreToken(d.score)} />
                <p className="mt-1 text-right text-[11px] text-muted-foreground">
                  {d.ratedCount}/{d.totalCount} rated
                </p>
              </div>
              {d.severeCount > 0 ? (
                <Tag token="critical">
                  <AlertTriangle className="size-3" aria-hidden />{" "}
                  {d.severeCount} severe
                </Tag>
              ) : null}
              <ScoreChip score={d.score} />
              <ChevronDown
                className={cn(
                  "size-4 shrink-0 transition-transform",
                  open && "rotate-180",
                )}
              />
            </button>
            {open ? (
              <div className="divide-y divide-border">
                {d.criteria.map((c) => (
                  <CriterionRow
                    key={c.criterion.id}
                    assessmentId={assessmentId}
                    result={c}
                  />
                ))}
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}

function CriterionRow({
  assessmentId,
  result,
}: {
  assessmentId: string;
  result: CriterionResult;
}) {
  const save = useSaveCapScore(assessmentId);
  const [expanded, setExpanded] = useState<CapDimension | null>(null);

  return (
    <div className="px-5 py-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-48 flex-1">
          <p className="text-sm font-medium text-foreground">
            {result.criterion.name}
          </p>
          {result.severe ? (
            <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-widest text-critical">
              Severe constraint
            </p>
          ) : null}
        </div>
        <ScoreChip score={result.score} size="sm" />
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-5">
        {DIMENSIONS.map((dim) => {
          const row = result.byDimension[dim.key];
          const na = row?.not_applicable ?? false;
          return (
            <div key={dim.key} className="rounded-md border border-border p-2">
              <button
                type="button"
                title={dim.question}
                onClick={() =>
                  setExpanded(expanded === dim.key ? null : dim.key)
                }
                className="eyebrow block w-full text-left hover:text-foreground"
              >
                {dim.label}
              </button>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {[0, 1, 2, 3, 4, 5].map((v) => (
                  <button
                    key={v}
                    type="button"
                    disabled={na}
                    onClick={() =>
                      save.mutate({
                        criterion_id: result.criterion.id,
                        dimension: dim.key,
                        score: row?.score === v ? null : v,
                        not_applicable: false,
                        rationale: row?.rationale ?? null,
                        confidence: row?.confidence ?? null,
                      })
                    }
                    className={cn(
                      "size-7 rounded-sm border font-display text-xs font-semibold transition-colors",
                      row?.score === v && !na
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border text-muted-foreground hover:border-primary/60 hover:text-foreground",
                      na && "opacity-40",
                    )}
                  >
                    {v}
                  </button>
                ))}
              </div>
              <label className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <input
                  type="checkbox"
                  checked={na}
                  onChange={(e) =>
                    save.mutate({
                      criterion_id: result.criterion.id,
                      dimension: dim.key,
                      score: null,
                      not_applicable: e.target.checked,
                      rationale: row?.rationale ?? null,
                      confidence: row?.confidence ?? null,
                    })
                  }
                />
                N/A
              </label>
            </div>
          );
        })}
      </div>

      {expanded ? (
        <RationaleEditor
          key={expanded}
          question={DIMENSIONS.find((d) => d.key === expanded)!.question}
          value={result.byDimension[expanded]?.rationale ?? ""}
          onSave={(rationale) =>
            save.mutate({
              criterion_id: result.criterion.id,
              dimension: expanded,
              score: result.byDimension[expanded]?.score ?? null,
              not_applicable:
                result.byDimension[expanded]?.not_applicable ?? false,
              rationale,
              confidence: result.byDimension[expanded]?.confidence ?? null,
            })
          }
        />
      ) : null}
    </div>
  );
}

function RationaleEditor({
  question,
  value,
  onSave,
}: {
  question: string;
  value: string;
  onSave: (v: string) => void;
}) {
  const [text, setText] = useState(value);
  return (
    <div className="mt-3 rounded-md border border-dashed border-border p-3">
      <p className="text-xs text-muted-foreground">{question}</p>
      <Textarea
        className="mt-2 min-h-16"
        placeholder="Assessor judgment and supporting evidence for this rating"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <Button size="sm" className="mt-2" onClick={() => onSave(text)}>
        Save rationale
      </Button>
    </div>
  );
}
