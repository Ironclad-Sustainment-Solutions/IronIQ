/**
 * Real, permanent delete for organizations and facilities — distinct
 * from archiveOrganization/archiveFacility (mutations.functions.ts),
 * which only flip a status flag. This is genuinely destructive (ON
 * DELETE CASCADE removes every dependent row — findings, assessments,
 * CAD jobs, CNC log entries, everything), so it's gated to ironiq_admin
 * specifically, same explicit-check pattern as admin-users.functions.ts
 * rather than relying on RLS alone to fail quietly.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/auth-middleware";
import { withUser, withAdmin } from "@/lib/db.server";

async function requireAdminRole(userId: string): Promise<void> {
  const isAdmin = await withUser(userId, async (client) => {
    const { rows } = await client.query(
      "SELECT 1 FROM public.user_roles WHERE user_id = $1 AND role = 'ironiq_admin'",
      [userId],
    );
    return rows.length > 0;
  });
  if (!isAdmin) throw new Error("This requires ironiq_admin access.");
}

const DeleteOrgInput = z.object({ id: z.string().uuid() });

export const deleteOrganization = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => DeleteOrgInput.parse(d))
  .handler(async ({ data, context }) => {
    await requireAdminRole(context.userId);
    // withAdmin, not withUser — deleting genuinely needs to work
    // regardless of the calling admin's own org membership/access scope,
    // same reasoning already established for signup()/login() and the
    // Intelligence Layer's pattern-generation step.
    await withAdmin((client) =>
      client.query("DELETE FROM public.organizations WHERE id = $1", [data.id]),
    );
  });

const DeleteFacilityInput = z.object({ id: z.string().uuid() });

export const deleteFacility = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => DeleteFacilityInput.parse(d))
  .handler(async ({ data, context }) => {
    await requireAdminRole(context.userId);
    await withAdmin((client) =>
      client.query("DELETE FROM public.facilities WHERE id = $1", [data.id]),
    );
  });
