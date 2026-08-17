/**
 * Executive transparency view (Phase G) — rollup metrics over the
 * estimating/quoting workflow, deliberately kept separate from the
 * operational RFQ tools themselves (creating quotes, assigning
 * estimators, etc. — that stays its own real day-to-day workflow). This
 * reads from the same underlying rfqs/estimates/quotes tables an
 * executive would otherwise have to piece together manually, and
 * belongs under the Intelligence Layer's "give leadership visibility
 * across the business" umbrella rather than being another operational
 * tool, per the roadmap's Part 1 distinction on this exact point.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/auth-middleware";
import { withUser } from "@/lib/db.server";

const RollupInput = z.object({ organizationId: z.string().uuid() });

export const getEstimatingRollup = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => RollupInput.parse(d))
  .handler(({ data, context }) =>
    withUser(context.userId, async (client) => {
      const funnel = await client.query(
        `SELECT status, count(*)::int AS count
           FROM public.rfqs WHERE organization_id = $1
          GROUP BY status`,
        [data.organizationId],
      );

      // Win rate: of quotes that reached a final resolved state (accepted
      // or declined/expired — i.e. the customer actually responded, one
      // way or the other), what share were accepted. Quotes still in
      // draft/pending/sent aren't resolved yet, so they're excluded from
      // the denominator rather than counted as losses.
      const winRate = await client.query(
        `SELECT
           count(*) FILTER (WHERE status = 'accepted')::int AS won,
           count(*) FILTER (WHERE status IN ('accepted', 'declined', 'expired'))::int AS resolved
         FROM public.quotes WHERE organization_id = $1`,
        [data.organizationId],
      );

      // Average margin across estimates that actually have a recommended
      // price to compute a margin against (avoids division by zero on
      // draft estimates with no pricing yet).
      const margin = await client.query(
        `SELECT avg((recommended_price - total_cost) / NULLIF(recommended_price, 0))::numeric(5,3) AS avg_margin,
                count(*)::int AS estimate_count
           FROM public.estimates
          WHERE organization_id = $1 AND recommended_price > 0`,
        [data.organizationId],
      );

      // Average time from a quote being sent to the customer actually
      // responding — a real quote-to-close cycle-time metric, not a
      // vanity number.
      const cycleTime = await client.query(
        `SELECT avg(EXTRACT(EPOCH FROM (responded_at - sent_at)) / 86400.0)::numeric(6,1) AS avg_days
           FROM public.quotes
          WHERE organization_id = $1 AND sent_at IS NOT NULL AND responded_at IS NOT NULL`,
        [data.organizationId],
      );

      const won = winRate.rows[0]?.won ?? 0;
      const resolved = winRate.rows[0]?.resolved ?? 0;

      return {
        rfqFunnel: funnel.rows as { status: string; count: number }[],
        winRate: resolved > 0 ? won / resolved : null,
        wonCount: won,
        resolvedCount: resolved,
        avgMargin:
          margin.rows[0]?.avg_margin !== null
            ? Number(margin.rows[0].avg_margin)
            : null,
        estimateCount: margin.rows[0]?.estimate_count ?? 0,
        avgQuoteToResponseDays:
          cycleTime.rows[0]?.avg_days !== null
            ? Number(cycleTime.rows[0].avg_days)
            : null,
      };
    }),
  );
