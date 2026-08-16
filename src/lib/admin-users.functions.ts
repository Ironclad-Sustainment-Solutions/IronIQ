/**
 * Admin-only user management: approve pending signups, assign global
 * roles, and attach/detach organization membership.
 *
 * These are gated to real ironiq_admin specifically, not the broader
 * "platform staff" (ironiq_admin OR consultant) that some RLS policies
 * use elsewhere — a consultant can already see across every organization
 * for assessment work, but approving new accounts and granting admin
 * rights is deliberately narrower. RLS backs most of this up already
 * (admins manage roles / admins approve profiles both check for
 * ironiq_admin specifically), but requireAdminRole() gives a clean error
 * message instead of a silent "0 rows affected" — same reasoning as the
 * app's existing preference for explicit checks over relying on RLS alone
 * to fail quietly.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/auth-middleware";
import { withUser, withAdmin } from "@/lib/db.server";

const APP_ROLES = [
  "ironiq_admin",
  "consultant",
  "customer_admin",
  "facility_manager",
  "assessor",
  "executive",
] as const;

async function requireAdminRole(userId: string): Promise<void> {
  const isAdmin = await withUser(userId, async (client) => {
    const { rows } = await client.query(
      "SELECT 1 FROM public.user_roles WHERE user_id = $1 AND role = 'ironiq_admin'",
      [userId],
    );
    return rows.length > 0;
  });
  if (!isAdmin) throw new Error("Admin access required.");
}

export const listAllUsers = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    await requireAdminRole(context.userId);
    return withUser(context.userId, async (client) => {
      const { rows } = await client.query(
        `SELECT
           p.id, p.email, p.full_name, p.job_title, p.approved, p.created_at,
           COALESCE(array_agg(DISTINCT r.role) FILTER (WHERE r.role IS NOT NULL), '{}') AS roles,
           COALESCE(
             json_agg(DISTINCT jsonb_build_object(
               'membership_id', om.id,
               'organization_id', om.organization_id,
               'organization_name', o.name,
               'role', om.role
             )) FILTER (WHERE om.organization_id IS NOT NULL),
             '[]'
           ) AS organizations
         FROM public.profiles p
         LEFT JOIN public.user_roles r ON r.user_id = p.id
         LEFT JOIN public.organization_members om ON om.user_id = p.id
         LEFT JOIN public.organizations o ON o.id = om.organization_id
         GROUP BY p.id
         ORDER BY p.approved ASC, p.created_at DESC`,
      );
      return rows;
    });
  });

const ApproveUserInput = z.object({ id: z.string().uuid() });

export const approveUser = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => ApproveUserInput.parse(d))
  .handler(async ({ data, context }) => {
    await requireAdminRole(context.userId);
    await withUser(context.userId, (client) =>
      client.query("UPDATE public.profiles SET approved = true WHERE id = $1", [
        data.id,
      ]),
    );
  });

const RejectUserInput = z.object({ id: z.string().uuid() });

/**
 * Deletes the account outright rather than just leaving it unapproved —
 * app_users has no RLS/grants for app_user to delete it directly (only
 * withAdmin/app_admin can), so this is the one operation in this file that
 * needs the RLS-bypassing role. requireAdminRole() above is the actual
 * authorization boundary for this call, not RLS.
 */
export const rejectUser = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => RejectUserInput.parse(d))
  .handler(async ({ data, context }) => {
    await requireAdminRole(context.userId);
    await withAdmin(async (client) => {
      await client.query("DELETE FROM public.app_users WHERE id = $1", [
        data.id,
      ]);
    });
  });

const SetUserRoleInput = z.object({
  userId: z.string().uuid(),
  role: z.enum(APP_ROLES),
});

/** Replaces, not stacks — a user has exactly one role after this call. */
export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => SetUserRoleInput.parse(d))
  .handler(async ({ data, context }) => {
    await requireAdminRole(context.userId);
    await withUser(context.userId, async (client) => {
      await client.query("DELETE FROM public.user_roles WHERE user_id = $1", [
        data.userId,
      ]);
      await client.query(
        "INSERT INTO public.user_roles (user_id, role) VALUES ($1, $2)",
        [data.userId, data.role],
      );
    });
  });

const AddOrgMembershipInput = z.object({
  userId: z.string().uuid(),
  organizationId: z.string().uuid(),
  role: z.enum(APP_ROLES),
});

export const addOrgMembership = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => AddOrgMembershipInput.parse(d))
  .handler(async ({ data, context }) => {
    await requireAdminRole(context.userId);
    await withUser(context.userId, (client) =>
      client.query(
        `INSERT INTO public.organization_members (organization_id, user_id, role)
         VALUES ($1, $2, $3)
         ON CONFLICT (organization_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
        [data.organizationId, data.userId, data.role],
      ),
    );
  });

const RemoveOrgMembershipInput = z.object({ membershipId: z.string().uuid() });

export const removeOrgMembership = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => RemoveOrgMembershipInput.parse(d))
  .handler(async ({ data, context }) => {
    await requireAdminRole(context.userId);
    await withUser(context.userId, (client) =>
      client.query("DELETE FROM public.organization_members WHERE id = $1", [
        data.membershipId,
      ]),
    );
  });
