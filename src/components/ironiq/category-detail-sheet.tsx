import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { SeverityBadge, FindingStatusBadge } from "@/components/ironiq/badges";
import { EmptyState } from "@/components/ironiq/layout-primitives";
import { formatScore } from "@/lib/scoring";
import { formatDate } from "@/lib/utils";
import type { CategoryResult } from "@/lib/scoring";
import type {
  AssessmentQuestion,
  AssessmentResponse,
  Finding,
} from "@/lib/domain";

const EVIDENCE_LABEL: Record<string, string> = {
  none: "No evidence",
  verbal: "Verbal",
  document: "Document",
  record_sampled: "Record sampled",
  direct_observation: "Direct observation",
  system_data: "System data",
};

export function CategoryDetailSheet({
  detail,
  questions,
  responses,
  findings,
  assessmentId,
  onOpenChange,
}: {
  detail: CategoryResult | null;
  questions: AssessmentQuestion[];
  responses: AssessmentResponse[];
  findings: Finding[];
  assessmentId?: string;
  onOpenChange: (open: boolean) => void;
}) {
  const responseByQuestion = useMemo(
    () => new Map(responses.map((r) => [r.question_id, r])),
    [responses],
  );

  const categoryQuestions = useMemo(
    () =>
      detail
        ? questions
            .filter((q) => q.category_id === detail.category.id && !q.archived)
            .sort((a, b) => a.sort_order - b.sort_order)
        : [],
    [detail, questions],
  );

  const categoryFindings = useMemo(
    () =>
      detail
        ? findings.filter(
            (f) =>
              f.category_name === detail.category.name ||
              categoryQuestions.some((q) => q.id === f.question_id),
          )
        : [],
    [detail, findings, categoryQuestions],
  );

  return (
    <Sheet open={Boolean(detail)} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        {detail ? (
          <>
            <SheetHeader className="text-left">
              <p className="eyebrow">
                {detail.category.code} · weight {Number(detail.category.weight)}
                %
              </p>
              <SheetTitle>{detail.category.name}</SheetTitle>
              <SheetDescription>
                {detail.category.description ??
                  "Question-level breakdown for this readiness category."}
              </SheetDescription>
            </SheetHeader>

            <div className="mt-4 grid grid-cols-3 gap-3">
              <div className="panel px-4 py-3">
                <p className="eyebrow">Score</p>
                <p className="metric mt-1 text-2xl font-semibold">
                  {formatScore(detail.score)}
                </p>
              </div>
              <div className="panel px-4 py-3">
                <p className="eyebrow">Answered</p>
                <p className="metric mt-1 text-2xl font-semibold">
                  {detail.answered}
                  <span className="text-base text-muted-foreground">
                    /{detail.applicable}
                  </span>
                </p>
              </div>
              <div className="panel px-4 py-3">
                <p className="eyebrow">Critical fails</p>
                <p className="metric mt-1 text-2xl font-semibold">
                  {detail.criticalFailures.length}
                </p>
              </div>
            </div>

            <section className="mt-6">
              <h3 className="eyebrow mb-2">Questions</h3>
              {categoryQuestions.length === 0 ? (
                <EmptyState message="No questions in this category." />
              ) : (
                <ul className="divide-y divide-border">
                  {categoryQuestions.map((q) => {
                    const r = responseByQuestion.get(q.id);
                    const na = r?.not_applicable;
                    return (
                      <li key={q.id} className="py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm text-foreground">
                              {q.is_critical ? (
                                <ShieldAlert
                                  className="mr-1 inline size-3.5 text-critical"
                                  aria-hidden
                                />
                              ) : null}
                              <span className="metric text-xs text-muted-foreground">
                                {q.question_code}
                              </span>{" "}
                              {q.question_text}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              Weight {Number(q.weight)} ·{" "}
                              {EVIDENCE_LABEL[r?.evidence_type ?? "none"] ??
                                "No evidence"}
                            </p>
                          </div>
                          <span className="metric shrink-0 text-sm font-semibold">
                            {na ? "N/A" : (r?.score ?? "—")}
                            {!na &&
                            r?.score !== null &&
                            r?.score !== undefined ? (
                              <span className="text-muted-foreground">/5</span>
                            ) : null}
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section className="mt-6">
              <h3 className="eyebrow mb-2">
                Findings ({categoryFindings.length})
              </h3>
              {categoryFindings.length === 0 ? (
                <EmptyState message="No findings recorded for this category." />
              ) : (
                <ul className="divide-y divide-border">
                  {categoryFindings.map((f) => (
                    <li key={f.id} className="flex items-start gap-3 py-3">
                      <SeverityBadge severity={f.severity} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-foreground">
                          {f.description}
                        </p>
                        <p className="metric mt-1 text-xs text-muted-foreground">
                          {f.finding_code} · {formatDate(f.target_date)}
                        </p>
                      </div>
                      <FindingStatusBadge status={f.status} />
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <div className="mt-6 flex gap-2">
              {assessmentId ? (
                <Button asChild variant="outline">
                  <Link
                    to="/assessments/$assessmentId"
                    params={{ assessmentId }}
                  >
                    Open assessment
                  </Link>
                </Button>
              ) : null}
              <Button asChild variant="ghost">
                <Link to="/findings">View all findings</Link>
              </Button>
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
