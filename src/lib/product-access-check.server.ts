/**
 * Split into its own .server.ts file for the same reason as
 * intake-shared.server.ts and intelligence-capture.server.ts — this is a
 * plain function that calls withUser directly, and mixing it into a file
 * that also exports createServerFn results (product-access.functions.ts)
 * breaks TanStack Start's client/server code splitting (the Phase 4 bug
 * this project already hit once).
 */

import { withUser } from "@/lib/db.server";

type Product = "assessment" | "cad" | "cnc";

/** Throws if the given product is restricted for the given organization. */
export async function assertProductAllowed(
  userId: string,
  organizationId: string,
  product: Product,
): Promise<void> {
  const restricted = await withUser(userId, async (client) => {
    const { rows } = await client.query(
      `SELECT 1 FROM public.organization_product_restrictions WHERE organization_id = $1 AND product = $2`,
      [organizationId, product],
    );
    return rows.length > 0;
  });
  if (restricted) {
    throw new Error(`This organization does not have access to ${product}.`);
  }
}
