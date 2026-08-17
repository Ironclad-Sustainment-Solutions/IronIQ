/**
 * Review queue for anonymized intelligence_patterns — the human gate
 * required before any pattern is visible to another organization (Phase
 * A/B). Gated to platform staff (ironiq_admin or consultant), matching
 * the RLS policies on this table exactly rather than introducing a
 * different authorization boundary here.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/auth-middleware";
import { withUser } from "@/lib/db.server";
import { embedText, toVectorLiteral } from "@/lib/embeddings.server";

async function requirePlatformStaff(userId: string): Promise<void> {
  const isStaff = await withUser(userId, async (client) => {
    const { rows } = await client.query(
      `SELECT 1 FROM public.user_roles WHERE user_id = $1 AND role IN ('ironiq_admin', 'consultant')`,
      [userId],
    );
    return rows.length > 0;
  });
  if (!isStaff) throw new Error("This requires platform staff access.");
}

export const listPendingPatterns = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    await requirePlatformStaff(context.userId);
    return withUser(context.userId, async (client) => {
      const { rows } = await client.query(
        `SELECT id, product, category_label, pattern_summary, pattern_resolution, pattern_outcome, created_at
           FROM public.intelligence_patterns
          WHERE status = 'pending_review'
          ORDER BY created_at ASC`,
      );
      return rows;
    });
  });

const ApprovePatternInput = z.object({ id: z.string().uuid() });

export const approveIntelligencePattern = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => ApprovePatternInput.parse(d))
  .handler(async ({ data, context }) => {
    await requirePlatformStaff(context.userId);

    const pattern = await withUser(context.userId, async (client) => {
      const { rows } = await client.query<{
        pattern_summary: string;
        pattern_resolution: string | null;
      }>(
        `SELECT pattern_summary, pattern_resolution FROM public.intelligence_patterns WHERE id = $1`,
        [data.id],
      );
      return rows[0];
    });
    if (!pattern) throw new Error("Pattern not found.");

    // Embed summary + resolution together — this is what gets matched
    // against a future question, so it should represent the whole
    // pattern, not just the problem half of it.
    const embeddingText = [pattern.pattern_summary, pattern.pattern_resolution]
      .filter(Boolean)
      .join("\n\n");
    let embeddingLiteral: string | null = null;
    try {
      const embedding = await embedText(embeddingText);
      embeddingLiteral = toVectorLiteral(embedding);
    } catch (error) {
      // Approve anyway — a pattern without an embedding yet is still
      // correctly gated and correctly visible to other orgs; it just
      // won't surface in similarity search until re-embedded. Better than
      // blocking the whole review action on the embedding provider being
      // configured.
      console.error(
        "Embedding generation failed while approving pattern",
        data.id,
        error,
      );
    }

    await withUser(context.userId, (client) =>
      client.query(
        `UPDATE public.intelligence_patterns
            SET status = 'approved', reviewed_by = $2, reviewed_at = now()
                ${embeddingLiteral ? ", embedding = $3" : ""}
          WHERE id = $1`,
        embeddingLiteral
          ? [data.id, context.userId, embeddingLiteral]
          : [data.id, context.userId],
      ),
    );
  });

const RejectPatternInput = z.object({
  id: z.string().uuid(),
  reason: z.string().optional(),
});

export const rejectIntelligencePattern = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => RejectPatternInput.parse(d))
  .handler(async ({ data, context }) => {
    await requirePlatformStaff(context.userId);
    await withUser(context.userId, (client) =>
      client.query(
        `UPDATE public.intelligence_patterns
            SET status = 'rejected', reviewed_by = $2, reviewed_at = now(), rejection_reason = $3
          WHERE id = $1`,
        [data.id, context.userId, data.reason ?? null],
      ),
    );
  });
