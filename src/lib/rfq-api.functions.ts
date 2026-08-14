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
        : await client.query("SELECT * FROM public.rfqs ORDER BY created_at DESC");
      if (rfqs.length === 0) return [];

      const rfqIds = rfqs.map((r) => r.id as string);
      const { rows: parts } = await client.query(
        "SELECT * FROM public.rfq_parts WHERE rfq_id = ANY($1) ORDER BY sort_order",
        [rfqIds],
      );
      if (parts.length === 0) return [];

      const partIds = parts.map((p) => p.id as string);
      const [requirements, files] = await Promise.all([
        client.query("SELECT * FROM public.rfq_requirements WHERE rfq_part_id = ANY($1)", [partIds]),
        client.query(
          "SELECT * FROM public.rfq_files WHERE rfq_id = ANY($1) AND superseded = false ORDER BY created_at",
          [rfqIds],
        ),
      ]);

      return parts.map((part) => ({
        part,
        rfq: rfqs.find((r) => r.id === part.rfq_id)!,
        requirement: requirements.rows.find((r) => r.rfq_part_id === part.id) ?? null,
        files: files.rows.filter(
          (f) => f.rfq_part_id === part.id || (!f.rfq_part_id && f.rfq_id === part.rfq_id),
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
        : await client.query("SELECT * FROM public.machines WHERE active = true ORDER BY model");
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
