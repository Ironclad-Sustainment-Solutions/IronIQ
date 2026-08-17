import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Panel } from "@/components/ironiq/layout-primitives";

/**
 * Deliberately NOT wired to live data yet — per an explicit product
 * decision: this view answers a question about Ironclad's own internal
 * RFQ/estimating performance, not something the three customer-facing
 * product streams (Assessment, CAD Conversion, CNC Coding) or the
 * Intelligence Layer deliver value on. Priority is proving customer-
 * facing business value first; internal-facing operational tooling like
 * this comes after that, not alongside it.
 *
 * The backend (src/lib/executive-rollup.functions.ts,
 * src/lib/executive-rollup-api.ts) is fully built and tested — real,
 * verified queries against rfqs/quotes/estimates, not placeholder code.
 * It's just not wired into this page. When this gets prioritized, the
 * fix here is literally swapping this placeholder component's body for
 * the one that already existed before this change (visible in this
 * branch's git history) — no new backend work needed at that point.
 */
export const Route = createFileRoute("/_authenticated/executive-rollup")({
  head: () => ({
    meta: [
      { title: "Executive Rollup (Coming Soon) — IronIQ" },
      {
        name: "description",
        content:
          "Estimating win rate, margin, and RFQ funnel — planned, not yet active.",
      },
      {
        property: "og:title",
        content: "Executive Rollup (Coming Soon) — IronIQ",
      },
      {
        property: "og:description",
        content: "Planned executive transparency view.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ExecutiveRollupComingSoonPage,
});

function ExecutiveRollupComingSoonPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader eyebrow="Coming Soon" title="Executive Rollup" />
      <Panel title="Not yet active">
        <p className="text-sm text-muted-foreground">
          This view is planned — estimating win rate, average margin,
          quote-to-response cycle time, and an RFQ funnel, all read-only for
          leadership visibility. It's held back deliberately: this answers a
          question about our own internal RFQ/estimating performance, not
          something the Assessment, CAD Conversion, or CNC Coding product
          streams (or the Intelligence Layer built on top of them) deliver value
          on for a customer. Proving that customer-facing value is the current
          priority.
        </p>
      </Panel>
    </div>
  );
}
