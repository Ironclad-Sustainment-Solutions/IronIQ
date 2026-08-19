/**
 * Product access restriction — org-level, deny-list, open by default
 * (per confirmed design). No row for (org, product) = allowed, matching
 * how every existing organization already behaves. A row's mere
 * existence is the restriction.
 *
 * The actual enforcement helpers (assertProductAllowed and its
 * assertProductAllowedFor*() lookup variants) live in
 * product-access-check.server.ts, not here — see that file's own note
 * on why. This file only exports createServerFn results.
 *
 * As of a later review pass, every CAD and CNC read/write path checks
 * the restriction (previously only the two "create new" entry points
 * did — an org whose access was revoked after creating records could
 * still fully read/re-process/edit/delete every one of them; see
 * product-access-check.server.ts's assertProductAllowedForCadJob /
 * assertProductAllowedForCadField / assertProductAllowedForCncLogEntry).
 *
 * Still not covered: the Assessment product has many separate write
 * paths (template assessment scoring, cap_assessments, field_assessments,
 * corrective actions, improvement projects) accumulated across this
 * whole build. A later pass added the same "guard the create entry
 * point" coverage CAD/CNC started with -- createAssessment in
 * api.functions.ts, createCapAssessment in capability-api.functions.ts,
 * createFieldAssessment in field-assessment-api.functions.ts -- but none
 * of the downstream actions on an already-created assessment (scoring,
 * closing, corrective actions, improvement projects) are guarded yet,
 * the same gap CAD/CNC had until their later pass closed it. Bulk
 * Intake's raw document upload (createIntakeUpload in
 * intake.functions.ts) and its three AI mapping adapters are
 * deliberately left out rather than guessed at -- Bulk Intake is a
 * shared document-intake layer that feeds all three systems (assessment,
 * capability, field), not something that maps cleanly onto a single
 * product category the way the other creation entry points do.
 * Client-side nav hiding still covers the visible, day-to-day case for
 * everything not listed above.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/auth-middleware";
import { withUser } from "@/lib/db.server";

type Product = "assessment" | "cad" | "cnc";

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

const ListRestrictionsInput = z.object({ organizationId: z.string().uuid() });

export const listProductRestrictions = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => ListRestrictionsInput.parse(d))
  .handler(({ data, context }) =>
    withUser(context.userId, async (client) => {
      const { rows } = await client.query<{ product: Product }>(
        `SELECT product FROM public.organization_product_restrictions WHERE organization_id = $1`,
        [data.organizationId],
      );
      return rows.map((r) => r.product);
    }),
  );

const SetRestrictionInput = z.object({
  organizationId: z.string().uuid(),
  product: z.enum(["assessment", "cad", "cnc"]),
  restricted: z.boolean(),
});

export const setProductRestriction = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => SetRestrictionInput.parse(d))
  .handler(async ({ data, context }) => {
    await requirePlatformStaff(context.userId);
    if (data.restricted) {
      await withUser(context.userId, (client) =>
        client.query(
          `INSERT INTO public.organization_product_restrictions (organization_id, product, restricted_by)
           VALUES ($1, $2, $3)
           ON CONFLICT (organization_id, product) DO NOTHING`,
          [data.organizationId, data.product, context.userId],
        ),
      );
    } else {
      await withUser(context.userId, (client) =>
        client.query(
          `DELETE FROM public.organization_product_restrictions WHERE organization_id = $1 AND product = $2`,
          [data.organizationId, data.product],
        ),
      );
    }
  });
