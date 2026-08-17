import { createFileRoute } from "@tanstack/react-router";
import {
  PageHeader,
  Panel,
  EmptyState,
} from "@/components/ironiq/layout-primitives";
import { useApp } from "@/context/app-context";
import { useEstimatingRollup } from "@/lib/executive-rollup-api";

export const Route = createFileRoute("/_authenticated/executive-rollup")({
  head: () => ({
    meta: [
      { title: "Executive Rollup — IronIQ" },
      {
        name: "description",
        content:
          "Estimating win rate, margin, and RFQ funnel — executive transparency into the business, separate from day-to-day RFQ operations.",
      },
      { property: "og:title", content: "Executive Rollup — IronIQ" },
      {
        property: "og:description",
        content: "Estimating and quoting performance at a glance.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ExecutiveRollupPage,
});

function formatStatusLabel(status: string): string {
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function ExecutiveRollupPage() {
  const { organization } = useApp();
  const rollup = useEstimatingRollup(organization?.id);

  if (!organization) {
    return (
      <div className="mx-auto max-w-5xl space-y-8">
        <PageHeader eyebrow="Intelligence Layer" title="Executive Rollup" />
        <EmptyState message="Select an organization first." />
      </div>
    );
  }

  const data = rollup.data;
  const totalRfqs = data?.rfqFunnel.reduce((sum, r) => sum + r.count, 0) ?? 0;

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <PageHeader
        eyebrow={organization.name}
        title="Executive Rollup"
        description="Estimating and quoting performance at a glance — this is a read-only view for leadership visibility, separate from the day-to-day RFQ/estimating workflow itself."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Panel title="Quote win rate">
          {data?.winRate !== null && data?.winRate !== undefined ? (
            <>
              <p className="font-display text-4xl font-bold text-foreground">
                {(data.winRate * 100).toFixed(0)}%
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {data.wonCount} of {data.resolvedCount} resolved quotes accepted
              </p>
            </>
          ) : (
            <EmptyState message="No resolved quotes yet." />
          )}
        </Panel>

        <Panel title="Average margin">
          {data?.avgMargin !== null && data?.avgMargin !== undefined ? (
            <>
              <p className="font-display text-4xl font-bold text-foreground">
                {(data.avgMargin * 100).toFixed(1)}%
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Across {data.estimateCount} priced estimates
              </p>
            </>
          ) : (
            <EmptyState message="No priced estimates yet." />
          )}
        </Panel>

        <Panel title="Avg. quote-to-response">
          {data?.avgQuoteToResponseDays !== null &&
          data?.avgQuoteToResponseDays !== undefined ? (
            <>
              <p className="font-display text-4xl font-bold text-foreground">
                {data.avgQuoteToResponseDays.toFixed(1)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                days, sent to customer response
              </p>
            </>
          ) : (
            <EmptyState message="No responded quotes yet." />
          )}
        </Panel>
      </div>

      <Panel title="RFQ funnel" subtitle={`${totalRfqs} total`}>
        {!data || data.rfqFunnel.length === 0 ? (
          <EmptyState message="No RFQs yet." />
        ) : (
          <div className="space-y-2">
            {data.rfqFunnel.map((stage) => (
              <div key={stage.status} className="flex items-center gap-3">
                <span className="w-48 shrink-0 text-sm text-foreground">
                  {formatStatusLabel(stage.status)}
                </span>
                <div className="h-2 flex-1 rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{
                      width: `${totalRfqs > 0 ? (stage.count / totalRfqs) * 100 : 0}%`,
                    }}
                  />
                </div>
                <span className="metric w-8 shrink-0 text-right text-sm text-muted-foreground">
                  {stage.count}
                </span>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
