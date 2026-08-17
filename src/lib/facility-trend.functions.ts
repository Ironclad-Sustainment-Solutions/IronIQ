/**
 * Option 3 from the roadmap discussion: cross-visit trend narration.
 * Deliberately the AI feature that doesn't depend on the Intelligence
 * Layer having accumulated any cross-client patterns — this narrates a
 * SINGLE facility's OWN historical data (readiness_history + findings
 * opened/closed between the two most recent recorded periods), so it's
 * useful from day one even with zero approved patterns anywhere.
 *
 * No embeddings, no cross-client search — a plain historical-delta query
 * followed by one generateText call, same guardrail discipline as
 * everything else: describe what changed, only explain why if the data
 * actually supports it, never invent a cause.
 */

import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";
import { createAnthropicProvider } from "@/lib/ai-gateway.server";
import { requireAuth } from "@/lib/auth/auth-middleware";
import { withUser } from "@/lib/db.server";

const MODEL = process.env["AI_MODEL"] ?? "claude-sonnet-5";

function gateway() {
  const key = process.env["ANTHROPIC_API_KEY"];
  if (!key) throw new Error("AI assistance is not configured.");
  return createAnthropicProvider(key);
}

const GUARDRAILS = `You are summarizing what changed at a facility between two readiness
snapshots, using ONLY the numbers provided below. Rules:
- Describe what changed (score deltas, findings opened/closed) plainly and factually.
- Only explain WHY something changed if the provided data actually supports a specific
  cause (e.g., a named finding that closed). Never invent a cause the numbers don't show.
- If the two periods are close in time with little data to compare, say so plainly rather
  than padding the summary with generic filler.
- Keep it to 2-3 sentences. This is a quick orientation, not a report.`;

const TrendInput = z.object({ facilityId: z.string().uuid() });

export const getFacilityTrendSummary = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => TrendInput.parse(d))
  .handler(async ({ data, context }) => {
    const history = await withUser(context.userId, async (client) => {
      const { rows } = await client.query<{
        period_label: string;
        recorded_on: string;
        overall_score: string;
        confidence_score: string | null;
      }>(
        `SELECT period_label, recorded_on, overall_score, confidence_score
           FROM public.readiness_history
          WHERE facility_id = $1
          ORDER BY recorded_on DESC
          LIMIT 2`,
        [data.facilityId],
      );
      return rows;
    });

    if (history.length < 2) {
      return {
        summary:
          "Not enough history yet to summarize a trend — this needs at least two recorded readiness snapshots for this facility.",
        hasEnoughData: false,
      };
    }

    const [current, previous] = history;

    const findingsDelta = await withUser(context.userId, async (client) => {
      const opened = await client.query<{ count: string }>(
        `SELECT count(*) FROM public.findings
          WHERE facility_id = $1 AND created_at::date > $2 AND created_at::date <= $3`,
        [data.facilityId, previous.recorded_on, current.recorded_on],
      );
      const closed = await client.query<{ count: string }>(
        `SELECT count(*) FROM public.findings
          WHERE facility_id = $1 AND status = 'closed'
            AND verification_date > $2 AND verification_date <= $3`,
        [data.facilityId, previous.recorded_on, current.recorded_on],
      );
      const closedFindings = await client.query<{
        description: string;
        severity: string;
      }>(
        `SELECT description, severity FROM public.findings
          WHERE facility_id = $1 AND status = 'closed'
            AND verification_date > $2 AND verification_date <= $3
          ORDER BY verification_date DESC
          LIMIT 5`,
        [data.facilityId, previous.recorded_on, current.recorded_on],
      );
      return {
        opened: Number(opened.rows[0]?.count ?? 0),
        closed: Number(closed.rows[0]?.count ?? 0),
        closedFindings: closedFindings.rows,
      };
    });

    const prompt = `Previous snapshot (${previous.period_label}, ${previous.recorded_on}):
Overall readiness score: ${previous.overall_score}
Confidence score: ${previous.confidence_score ?? "not recorded"}

Current snapshot (${current.period_label}, ${current.recorded_on}):
Overall readiness score: ${current.overall_score}
Confidence score: ${current.confidence_score ?? "not recorded"}

Findings opened in this period: ${findingsDelta.opened}
Findings closed in this period: ${findingsDelta.closed}
${
  findingsDelta.closedFindings.length > 0
    ? `Specific findings closed:\n${findingsDelta.closedFindings.map((f) => `- [${f.severity}] ${f.description}`).join("\n")}`
    : ""
}`;

    const result = await generateText({
      model: gateway()(MODEL),
      system: GUARDRAILS,
      prompt,
    });

    return { summary: result.text, hasEnoughData: true };
  });
