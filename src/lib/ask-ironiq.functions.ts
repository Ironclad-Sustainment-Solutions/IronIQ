/**
 * "Ask IronIQ" v2 — cross-product, per Phase G. Now that CNC (Phase F)
 * writes into intelligence_events the same way Assessment (Phase C)
 * does, this searches approved patterns across every product by
 * default, optionally scoped to one if the caller wants that (e.g. "only
 * search CNC precedent"). CAD (Phase E) doesn't feed intelligence_events
 * yet — a known, not-yet-closed gap from that phase — so in practice
 * this currently searches assessment + cnc patterns; it'll pick up CAD
 * patterns automatically once that gap is closed, no change needed here.
 *
 * This only ever searches APPROVED patterns — the anonymized, reviewed
 * layer, never raw intelligence_events. Same guardrail discipline as
 * every other AI feature in this app: answer only from what was actually
 * retrieved, cite it, and say plainly when nothing relevant was found
 * rather than filling the gap with a plausible-sounding guess.
 *
 * When nothing internal matches at all, this falls back to Claude's own
 * general knowledge rather than a dead end — but the response always
 * carries usedExternalKnowledge so the UI can render an unmistakably
 * different treatment for that case. An answer grounded in this app's
 * own reviewed client history and a generic AI answer with no connection
 * to it are fundamentally different kinds of trust, and conflating them
 * would be actively misleading.
 */

import { createServerFn } from "@tanstack/react-start";
import { generateText, Output } from "ai";
import { z } from "zod";
import { createAnthropicProvider } from "@/lib/ai-gateway.server";
import { requireAuth } from "@/lib/auth/auth-middleware";
import { checkAndRecordAiUsage } from "@/lib/auth/rate-limit.server";
import { withUser } from "@/lib/db.server";
import { embedText, toVectorLiteral } from "@/lib/embeddings.server";
import { isCycleRuntimeQuestion } from "@/lib/shop-floor";
import { resolveMachineEventTable } from "@/lib/machine-events.server";

const MODEL = process.env["AI_MODEL"] ?? "claude-sonnet-5";

function gateway() {
  const key = process.env["ANTHROPIC_API_KEY"];
  if (!key) throw new Error("AI assistance is not configured.");
  return createAnthropicProvider(key);
}

const GUARDRAILS = `You are answering a question using ONLY the precedent patterns retrieved
below — each one is an anonymized record of a problem another engagement actually resolved,
already reviewed and approved for sharing. Rules:
- Answer only from what's in the retrieved patterns. Never invent a resolution, a number, or
  a detail not present in them.
- Cite which pattern(s) informed your answer by their number (e.g. "per pattern 2").
- If none of the retrieved patterns are actually relevant to the question, say so plainly —
  do not stretch a loosely-related pattern into an answer it doesn't support.
- These patterns may come from different products (Assessment, CAD, CNC, Machines) — if you
  draw on patterns from more than one, be clear about which product each came from rather than
  blending them into one undifferentiated answer.
- This is precedent, not certainty — phrase the answer as "here's how a similar problem was
  resolved elsewhere," not as a guaranteed fix for the asker's own situation.`;

const LIVE_DATA_GUARDRAILS = `You are answering a question using ONLY the live shop-floor snapshot
data provided below, for the asker's own organization/facility. Rules:
- Answer only from the numbers and states actually present in the snapshot. Never invent a
  machine, a state, or a number not present in it.
- This is CURRENT, real-time-ish operational data (as of the snapshot timestamp), not historical
  precedent — phrase the answer as "right now" / "as of the last recorded event," not as a
  general pattern.
- If the snapshot has no data for what's being asked (e.g. a specific machine isn't in the
  snapshot, or there's no cycle data in the requested window), say so plainly.
- Be concise and factual — this is meant to answer "what's happening on my floor" quickly, not
  to produce a long report.`;

const PRODUCTS = ["assessment", "cad", "cnc", "machines"] as const;

const AskInput = z.object({
  question: z.string().min(1),
  // Undefined/omitted searches across all products — this is the actual
  // Phase G behavior. Passing one narrows to just that product, for a UI
  // that wants to let someone search "just CNC precedent," for example.
  products: z.array(z.enum(PRODUCTS)).optional(),
  // Needed only for the live shop-floor snapshot path (current machine
  // state/cycle data is inherently org-scoped, unlike anonymized
  // cross-engagement precedent patterns, which are the same regardless
  // of who's asking) -- optional because a caller only asking about
  // historical precedent has no need to pass it.
  organizationId: z.string().uuid().optional(),
  facilityId: z.string().uuid().optional(),
});

const TOP_K = 5;

interface FloorSnapshotRow {
  asset_id: string;
  name: string;
  latest_state: string | null;
  latest_ts: string | null;
  avg_cycle_time_s_7d: number | null;
  cycles_7d: number;
}

/**
 * A compact, textual "what's happening on the floor right now" summary
 * for the asker's own org/facility -- the live-data counterpart to
 * pattern retrieval. Closes the gap flagged when isCycleRuntimeQuestion
 * matched but no historical pattern did: previously that always
 * returned a canned "no precedent stored" message, even though the
 * actual answer (current state, recent cycle times) was sitting right
 * there in shop_machine_events the whole time -- just never queried.
 * Returns null if the table doesn't exist yet (ingest migration not
 * applied) or there are no machines in scope, so the caller can fall
 * back to the existing "no data" messaging rather than a false snapshot.
 */
async function fetchFloorSnapshot(
  userId: string,
  organizationId: string,
  facilityId: string,
): Promise<{ asOf: string; rows: FloorSnapshotRow[] } | null> {
  return withUser(userId, async (client) => {
    const table = await resolveMachineEventTable(client);
    if (!table) return null;

    const { rows } = await client.query<{
      asset_id: string;
      name: string;
      latest_state: string | null;
      latest_ts: string | null;
      avg_cycle_time_s_7d: string | null;
      cycles_7d: string;
    }>(
      `SELECT m.asset_id, m.name,
              latest.state AS latest_state,
              latest.ts_utc AS latest_ts,
              recent.avg_cycle_time_s AS avg_cycle_time_s_7d,
              COALESCE(recent.cycles, 0) AS cycles_7d
         FROM public.shop_machines m
         LEFT JOIN LATERAL (
           SELECT state, ts_utc FROM public.${table}
            WHERE shop_machine_id = m.id
            ORDER BY ts_utc DESC LIMIT 1
         ) latest ON true
         LEFT JOIN LATERAL (
           SELECT avg(cycle_time_s) AS avg_cycle_time_s, count(*) AS cycles
             FROM public.${table}
            WHERE shop_machine_id = m.id
              AND event_type = 'cycle_end'
              AND ts_utc > now() - interval '7 days'
         ) recent ON true
        WHERE m.organization_id = $1 AND m.facility_id = $2
        ORDER BY m.asset_id`,
      [organizationId, facilityId],
    );
    if (rows.length === 0) return null;
    return {
      asOf: new Date().toISOString(),
      rows: rows.map((r) => ({
        asset_id: r.asset_id,
        name: r.name,
        latest_state: r.latest_state,
        latest_ts: r.latest_ts,
        avg_cycle_time_s_7d:
          r.avg_cycle_time_s_7d == null ? null : Number(r.avg_cycle_time_s_7d),
        cycles_7d: Number(r.cycles_7d),
      })),
    };
  });
}

function formatFloorSnapshot(snapshot: {
  asOf: string;
  rows: FloorSnapshotRow[];
}): string {
  const lines = snapshot.rows.map((r) => {
    const state = r.latest_state ?? "no data";
    const asOf = r.latest_ts ? ` (as of ${r.latest_ts})` : "";
    const cycleInfo =
      r.cycles_7d > 0
        ? `, ${r.cycles_7d} cycles in the last 7 days, avg cycle time ${r.avg_cycle_time_s_7d?.toFixed(1)}s`
        : ", no cycle_end events in the last 7 days";
    return `- ${r.asset_id} (${r.name}): ${state}${asOf}${cycleInfo}`;
  });
  return `Snapshot as of ${snapshot.asOf}:\n${lines.join("\n")}`;
}

export const askIronIQ = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => AskInput.parse(d))
  .handler(async ({ data, context }) => {
    await checkAndRecordAiUsage(context.userId);
    const queryEmbedding = await embedText(data.question);
    const queryLiteral = toVectorLiteral(queryEmbedding);
    const productFilter =
      data.products && data.products.length > 0 ? data.products : null;

    const patterns = await withUser(context.userId, async (client) => {
      const { rows } = await client.query(
        `SELECT id, product, category_label, pattern_summary, pattern_resolution, pattern_outcome,
                embedding <=> $1 AS distance
           FROM public.intelligence_patterns
          WHERE status = 'approved'
            AND embedding IS NOT NULL
            AND ($3::public.intelligence_product[] IS NULL OR product = ANY($3))
          ORDER BY distance ASC
          LIMIT $2`,
        [queryLiteral, TOP_K, productFilter],
      );
      return rows as {
        id: string;
        product: "assessment" | "cad" | "cnc";
        category_label: string | null;
        pattern_summary: string;
        pattern_resolution: string | null;
        pattern_outcome: string | null;
        origin: "engagement_derived" | "reference_library";
        distance: number;
      }[];
    });

    if (patterns.length === 0) {
      if (isCycleRuntimeQuestion(data.question)) {
        // Previously always returned a canned "no precedent stored"
        // message here, even when the actual answer (current machine
        // state, recent cycle times) was sitting right in
        // shop_machine_events the whole time -- just never queried.
        // Now: if org/facility scope was provided, actually answer from
        // the live snapshot instead of a dead end.
        if (data.organizationId && data.facilityId) {
          const snapshot = await fetchFloorSnapshot(
            context.userId,
            data.organizationId,
            data.facilityId,
          );
          if (snapshot) {
            const snapshotText = formatFloorSnapshot(snapshot);
            const liveResult = await generateText({
              model: gateway()(MODEL),
              system: LIVE_DATA_GUARDRAILS,
              prompt: `Question: ${data.question}\n\nShop-floor snapshot:\n\n${snapshotText}`,
            });
            return {
              answer: liveResult.text,
              patterns: [],
              usedExternalKnowledge: false,
              noMatchingPrecedent: false,
              usedLiveFloorSnapshot: true,
            };
          }
        }
        return {
          answer:
            "No matching precedent for cycle time or runtime is stored in IronIQ, and no live shop-floor data is available for this organization/facility yet.",
          patterns: [],
          usedExternalKnowledge: false,
          noMatchingPrecedent: true,
        };
      }
      // Fallback: nothing in IronIQ's own reviewed precedent matched, so
      // answer from Claude's general knowledge instead of returning
      // nothing — but this MUST be clearly distinguishable from a
      // grounded-in-our-own-data answer, since one is verified internal
      // precedent and the other is generic AI knowledge with no
      // connection to this app's actual client history. Mixing those
      // two without a clear signal would let a generic-sounding answer
      // get mistaken for validated precedent.
      const fallback = await generateText({
        model: gateway()(MODEL),
        system: `No internal IronIQ precedent matched this question. Answer from your own
general knowledge instead, as a knowledgeable manufacturing/engineering assistant would.
Be genuinely helpful, but do not claim or imply this is based on IronIQ's own client
engagement history — it is not. If you're not confident in an accurate answer, say so
rather than guess.`,
        prompt: data.question,
      });

      return {
        answer: fallback.text,
        patterns: [],
        usedExternalKnowledge: true,
        noMatchingPrecedent: true,
      };
    }

    const context_block = patterns
      .map(
        (p, i) =>
          `Pattern ${i + 1} [${p.product}] (${p.category_label ?? "unspecified industry"}${p.origin === "reference_library" ? ", curated reference pattern" : ", from a past engagement"}):\nProblem: ${p.pattern_summary}\nResolution: ${p.pattern_resolution ?? "(not recorded)"}\nOutcome: ${p.pattern_outcome ?? "(not recorded)"}`,
      )
      .join("\n\n");

    const result = await generateText({
      model: gateway()(MODEL),
      system: GUARDRAILS,
      prompt: `Question: ${data.question}\n\nRetrieved patterns:\n\n${context_block}`,
    });

    return {
      answer: result.text,
      patterns,
      usedExternalKnowledge: false,
      noMatchingPrecedent: false,
    };
  });
