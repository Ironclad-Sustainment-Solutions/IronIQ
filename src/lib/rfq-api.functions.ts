import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/auth-middleware";
import { withUser } from "@/lib/db.server";

const optionalId = z.object({ id: z.string().uuid().optional() });

export const fetchEstimatingParts = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => optionalId.parse(d))
  .handler(({ data, context }) =>
    withUser(context.userId, async (client) => {
      const { rows: rfqs } = data.id
        ? await client.query(
            "SELECT * FROM public.rfqs WHERE organization_id = $1 ORDER BY created_at DESC",
            [data.id],
          )
        : await client.query(
            "SELECT * FROM public.rfqs ORDER BY created_at DESC",
          );
      if (rfqs.length === 0) return [];

      const rfqIds = rfqs.map((r) => r.id as string);
      const { rows: parts } = await client.query(
        "SELECT * FROM public.rfq_parts WHERE rfq_id = ANY($1) ORDER BY sort_order",
        [rfqIds],
      );
      if (parts.length === 0) return [];

      const partIds = parts.map((p) => p.id as string);
      const [requirements, files] = await Promise.all([
        client.query(
          "SELECT * FROM public.rfq_requirements WHERE rfq_part_id = ANY($1)",
          [partIds],
        ),
        client.query(
          "SELECT * FROM public.rfq_files WHERE rfq_id = ANY($1) AND superseded = false ORDER BY created_at",
          [rfqIds],
        ),
      ]);

      return parts.map((part) => ({
        part,
        rfq: rfqs.find((r) => r.id === part.rfq_id)!,
        requirement:
          requirements.rows.find((r) => r.rfq_part_id === part.id) ?? null,
        files: files.rows.filter(
          (f) =>
            f.rfq_part_id === part.id ||
            (!f.rfq_part_id && f.rfq_id === part.rfq_id),
        ),
      }));
    }),
  );

const rfqPartIdInput = z.object({ rfqPartId: z.string().uuid() });

export const fetchGeometryRuns = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => rfqPartIdInput.parse(d))
  .handler(({ data, context }) =>
    withUser(context.userId, async (client) => {
      const { rows } = await client.query(
        "SELECT * FROM public.geometry_analysis_runs WHERE rfq_part_id = $1 ORDER BY requested_at DESC",
        [data.rfqPartId],
      );
      return rows;
    }),
  );

export const fetchMachines = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => optionalId.parse(d))
  .handler(({ data, context }) =>
    withUser(context.userId, async (client) => {
      const { rows } = data.id
        ? await client.query(
            "SELECT * FROM public.machines WHERE active = true AND facility_id = $1 ORDER BY model",
            [data.id],
          )
        : await client.query(
            "SELECT * FROM public.machines WHERE active = true ORDER BY model",
          );
      return rows;
    }),
  );

export const fetchMaterials = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(({ context }) =>
    withUser(context.userId, async (client) => {
      const { rows } = await client.query(
        "SELECT * FROM public.materials WHERE active = true ORDER BY family, grade",
      );
      return rows;
    }),
  );

// ---- export-controlled access attestation ----
//
// rfqs.itar / rfqs.cui / rfqs.export_controlled previously fed only into
// the cost estimate's pricing multiplier -- nothing gated who could view
// a flagged RFQ, and there was no record of who'd looked at one. This adds
// a lightweight attestation + audit trail (not a hard access gate, and not
// step-up re-auth): the UI shows a click-through before rendering a
// flagged RFQ's detail, and confirming it writes an audit_logs row. Given
// how few people actually touch these day to day, requiring a fresh
// attestation (and a fresh log entry) on every distinct time someone
// opens one is the right tradeoff -- the friction is negligible at this
// volume, and it maximizes the audit trail's usefulness ("attested" always
// means "a real person just affirmatively looked at this, right now").
const AttestInput = z.object({ rfqId: z.string().uuid() });

export const attestExportControlledAccess = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => AttestInput.parse(d))
  .handler(async ({ data, context }) =>
    withUser(context.userId, async (client) => {
      // Re-read the RFQ under the caller's own RLS-scoped role rather than
      // trusting the client's claim about which flags are set or whether
      // this organization_id is really theirs to see -- withUser means
      // this SELECT returns nothing if RLS wouldn't otherwise let them see
      // this row, and the INSERT below then correctly fails/no-ops rather
      // than logging an attestation for a record they can't actually access.
      const { rows } = await client.query<{
        id: string;
        organization_id: string;
        rfq_number: string;
        itar: boolean;
        cui: boolean;
        export_controlled: boolean;
      }>(
        `SELECT id, organization_id, rfq_number, itar, cui, export_controlled
           FROM public.rfqs WHERE id = $1`,
        [data.rfqId],
      );
      const rfq = rows[0];
      if (!rfq) {
        throw new Error("RFQ not found or you don't have access to it.");
      }

      await client.query(
        `INSERT INTO public.audit_logs
           (organization_id, actor_id, action, entity_type, entity_id, details)
         VALUES ($1, $2, 'rfq.export_controlled_access_attested', 'rfq', $3, $4)`,
        [
          rfq.organization_id,
          context.userId,
          rfq.id,
          JSON.stringify({
            rfq_number: rfq.rfq_number,
            itar: rfq.itar,
            cui: rfq.cui,
            export_controlled: rfq.export_controlled,
          }),
        ],
      );

      return { attested: true as const };
    }),
  );
