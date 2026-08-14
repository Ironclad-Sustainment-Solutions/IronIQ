import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { useApp } from "@/context/app-context";
import { requireAuth } from "@/lib/auth/auth-middleware";
import { withUser } from "@/lib/db.server";

/**
 * Production-flow view of the signed-in IronIQ user.
 * Staff = platform/internal roles who run intake, planning and programming.
 */
export interface ProductionUser {
  id: string;
  fullName: string;
  email: string | null;
  organizationId: string | null;
  organizationName: string | null;
  isStaff: boolean;
  isAdmin: boolean;
}

export function useProductionUser(): ProductionUser | null {
  const { user, profile, roles, organization } = useApp();
  if (!user) return null;
  return {
    id: user.id,
    fullName: profile?.full_name ?? profile?.email ?? "IronIQ user",
    email: profile?.email ?? null,
    organizationId: organization?.id ?? null,
    organizationName: organization?.name ?? null,
    isStaff: roles.some((r) => r === "ironiq_admin" || r === "consultant" || r === "facility_manager"),
    isAdmin: roles.some((r) => r === "ironiq_admin" || r === "customer_admin"),
  };
}

const LogJobEventInput = z.object({
  jobId: z.string().uuid(),
  organizationId: z.string().uuid().nullable().optional(),
  actorName: z.string().nullable().optional(),
  action: z.string(),
  detail: z.string().nullable().optional(),
});

/** Append a production-flow event to the shared IronIQ audit log. */
export const logJobEvent = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: unknown) => LogJobEventInput.parse(input))
  .handler(async ({ data, context }) => {
    // actor_id always comes from the authenticated session, never trusted
    // client input, even though callers historically passed `actorId` too.
    await withUser(context.userId, (client) =>
      client.query(
        `INSERT INTO public.audit_logs (entity_type, entity_id, organization_id, actor_id, actor_name, action, details)
         VALUES ('job', $1, $2, $3, $4, $5, $6)`,
        [
          data.jobId,
          data.organizationId ?? null,
          context.userId,
          data.actorName ?? null,
          data.action,
          JSON.stringify(data.detail ? { detail: data.detail } : {}),
        ],
      ),
    );
    return { success: true };
  });

const FetchJobAuditInput = z.object({ jobId: z.string().uuid() });

/** Audit rows for one job, newest first. */
export const fetchJobAudit = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((input: unknown) => FetchJobAuditInput.parse(input))
  .handler(async ({ data, context }) => {
    const rows = await withUser(context.userId, async (client) => {
      const { rows } = await client.query(
        `SELECT id, action, details, actor_name, created_at
         FROM public.audit_logs
         WHERE entity_type = 'job' AND entity_id = $1
         ORDER BY created_at DESC
         LIMIT 40`,
        [data.jobId],
      );
      return rows;
    });
    return rows.map((row) => ({
      id: row.id,
      action: row.action,
      detail:
        row.details && typeof row.details === "object" && "detail" in row.details
          ? String((row.details as { detail?: unknown }).detail ?? "")
          : "",
      actor_name: row.actor_name,
      created_at: row.created_at,
    }));
  });
