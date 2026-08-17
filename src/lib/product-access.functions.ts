/**
 * Product access restriction — org-level, deny-list, open by default
 * (per confirmed design). No row for (org, product) = allowed, matching
 * how every existing organization already behaves. A row's mere
 * existence is the restriction.
 *
 * The actual enforcement helper (assertProductAllowed) lives in
 * product-access-check.server.ts, not here — see that file's own note
 * on why. This file only exports createServerFn results.
 *
 * Worth being explicit about what's NOT covered by the enforcement
 * check wired into CAD's and CNC's creation entry points: the
 * Assessment product has many separate write paths (template
 * assessment scoring, cap_assessments, field_assessments, Bulk Intake,
 * corrective actions, improvement projects) accumulated across this
 * whole build, and this pass does not add an enforcement check to every
 * one of them — client-side nav hiding covers the visible, day-to-day
 * case (a restricted org's users don't see Assessment in their sidebar
 * at all), but a determined user hitting an Assessment-product API
 * endpoint directly today would not be blocked server-side the way
 * CAD/CNC now are. Flagging this honestly rather than claiming complete
 * coverage.
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
