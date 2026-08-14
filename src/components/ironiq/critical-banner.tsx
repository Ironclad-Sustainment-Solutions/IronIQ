import { AlertTriangle } from "lucide-react";
import type { AssessmentQuestion } from "@/lib/domain";

export function CriticalRiskBanner({
  failures,
  gated,
}: {
  failures: AssessmentQuestion[];
  gated?: boolean;
}) {
  if (failures.length === 0) return null;
  return (
    <div className="rounded-md border border-critical/60 bg-critical/10 p-5">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-critical" aria-hidden />
        <div className="min-w-0">
          <h2 className="text-base font-semibold uppercase tracking-wider text-critical">
            {gated
              ? "Critical risk — readiness status capped at Conditionally Ready"
              : "Critical risk — failed critical controls"}
          </h2>
          <p className="mt-1 text-sm text-foreground/90">
            {failures.length} critical control{failures.length === 1 ? " is" : "s are"} scored 0 or 1.
            {gated
              ? " This facility cannot be labeled Production Ready or Advanced until every critical control is remediated and re-verified."
              : " Production Ready and Advanced ratings are blocked, and corrective action is required before production release."}
          </p>

          <ul className="mt-4 space-y-3">
            {failures.map((q) => (
              <li key={q.id} className="rounded-sm border border-critical/30 bg-background/40 p-3">
                <p className="font-display text-xs font-semibold uppercase tracking-widest text-critical">
                  Failed control · {q.question_code}
                </p>
                <p className="mt-1 text-sm text-foreground">{q.question_text}</p>
                {q.guidance_text ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground/80">Corrective action required: </span>
                    {q.guidance_text}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
