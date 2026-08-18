import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/auth-middleware";
import { withUser } from "@/lib/db.server";
import { assertColumnsAllowed } from "@/lib/column-allowlist";

const ALLOWED_TABLES = new Set([
  "cap_chain_nodes",
  "cap_metrics",
  "cap_observations",
  "cap_domain_screens",
  "cap_health_sweep",
  "cap_primary_constraints",
]);

function assertAllowed(table: string) {
  if (!ALLOWED_TABLES.has(table))
    throw new Error(`Table "${table}" is not allowed here.`);
}

const assessmentIdInput = z.object({ assessmentId: z.string().uuid() });

export const fetchCapInvestigation = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => assessmentIdInput.parse(d))
  .handler(({ data, context }) =>
    withUser(context.userId, async (client) => {
      const id = data.assessmentId;
      const [metrics, observations, screens, chain, sweep, constraint] =
        await Promise.all([
          client.query(
            "SELECT * FROM public.cap_metrics WHERE assessment_id = $1 ORDER BY created_at",
            [id],
          ),
          client.query(
            "SELECT * FROM public.cap_observations WHERE assessment_id = $1 ORDER BY created_at",
            [id],
          ),
          client.query(
            "SELECT * FROM public.cap_domain_screens WHERE assessment_id = $1",
            [id],
          ),
          client.query(
            "SELECT * FROM public.cap_chain_nodes WHERE assessment_id = $1 ORDER BY sort_order",
            [id],
          ),
          client.query(
            "SELECT * FROM public.cap_health_sweep WHERE assessment_id = $1",
            [id],
          ),
          client.query(
            "SELECT * FROM public.cap_primary_constraints WHERE assessment_id = $1",
            [id],
          ),
        ]);
      return {
        metrics: metrics.rows,
        observations: observations.rows,
        screens: screens.rows,
        chain: chain.rows,
        sweep: sweep.rows,
        constraint: constraint.rows[0] ?? null,
      };
    }),
  );

const InvestigationUpsertInput = z.object({
  table: z.string(),
  assessmentId: z.string().uuid(),
  id: z.string().uuid().optional(),
  values: z.record(z.any()),
});

export const investigationUpsert = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => InvestigationUpsertInput.parse(d))
  .handler(({ data, context }) => {
    assertAllowed(data.table);
    return withUser(context.userId, async (client) => {
      const payload = {
        ...data.values,
        assessment_id: data.assessmentId,
        modified_by: context.userId,
      };
      if (data.id) {
        const cols = Object.keys(payload);
        assertColumnsAllowed(data.table, cols);
        const setClause = cols.map((c, i) => `${c} = $${i + 1}`).join(", ");
        await client.query(
          `UPDATE public.${data.table} SET ${setClause} WHERE id = $${cols.length + 1}`,
          [...Object.values(payload), data.id],
        );
        return data.id;
      }
      const insertPayload = { ...payload, created_by: context.userId };
      const cols = Object.keys(insertPayload);
      assertColumnsAllowed(data.table, cols);
      const placeholders = cols.map((_, i) => `$${i + 1}`).join(", ");
      const { rows } = await client.query(
        `INSERT INTO public.${data.table} (${cols.join(", ")}) VALUES (${placeholders}) RETURNING id`,
        Object.values(insertPayload),
      );
      return rows[0].id as string;
    });
  });

const InvestigationDeleteInput = z.object({
  table: z.string(),
  id: z.string().uuid(),
});

export const investigationDelete = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => InvestigationDeleteInput.parse(d))
  .handler(async ({ data, context }) => {
    assertAllowed(data.table);
    await withUser(context.userId, (client) =>
      client.query(`DELETE FROM public.${data.table} WHERE id = $1`, [data.id]),
    );
  });

const SetDomainScreenInput = z.object({
  assessmentId: z.string().uuid(),
  domain_id: z.string().uuid(),
  status: z.string().optional(),
  screen_items: z.array(z.string()).optional(),
  notes: z.string().nullable().optional(),
});

export const setDomainScreen = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => SetDomainScreenInput.parse(d))
  .handler(async ({ data, context }) => {
    await withUser(context.userId, (client) =>
      client.query(
        `INSERT INTO public.cap_domain_screens
           (assessment_id, domain_id, status, screen_items, notes, created_by, modified_by)
         VALUES ($1,$2,$3,$4,$5,$6,$6)
         ON CONFLICT (assessment_id, domain_id)
         DO UPDATE SET
           status = COALESCE($3, public.cap_domain_screens.status),
           screen_items = COALESCE($4, public.cap_domain_screens.screen_items),
           notes = COALESCE($5, public.cap_domain_screens.notes),
           modified_by = $6`,
        [
          data.assessmentId,
          data.domain_id,
          data.status ?? null,
          data.screen_items ?? null,
          data.notes ?? null,
          context.userId,
        ],
      ),
    );
  });

const SetHealthSweepInput = z.object({
  assessmentId: z.string().uuid(),
  domain_id: z.string().uuid(),
  classification: z.string().optional(),
  note: z.string().nullable().optional(),
});

export const setHealthSweep = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => SetHealthSweepInput.parse(d))
  .handler(async ({ data, context }) => {
    await withUser(context.userId, (client) =>
      client.query(
        `INSERT INTO public.cap_health_sweep
           (assessment_id, domain_id, classification, note, created_by, modified_by)
         VALUES ($1,$2,$3,$4,$5,$5)
         ON CONFLICT (assessment_id, domain_id)
         DO UPDATE SET
           classification = COALESCE($3, public.cap_health_sweep.classification),
           note = COALESCE($4, public.cap_health_sweep.note),
           modified_by = $5`,
        [
          data.assessmentId,
          data.domain_id,
          data.classification ?? null,
          data.note ?? null,
          context.userId,
        ],
      ),
    );
  });

const SavePrimaryConstraintInput = z.object({
  assessmentId: z.string().uuid(),
  values: z.record(z.any()),
});

export const savePrimaryConstraint = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => SavePrimaryConstraintInput.parse(d))
  .handler(({ data, context }) =>
    withUser(context.userId, async (client) => {
      const payload = {
        ...data.values,
        assessment_id: data.assessmentId,
        declared_by: context.userId,
        declared_at: new Date().toISOString(),
        created_by: context.userId,
        modified_by: context.userId,
      };
      const cols = Object.keys(payload);
      const placeholders = cols.map((_, i) => `$${i + 1}`).join(", ");
      const updates = cols
        .filter((c) => c !== "assessment_id" && c !== "created_by")
        .map((c) => `${c} = EXCLUDED.${c}`)
        .join(", ");
      await client.query(
        `INSERT INTO public.cap_primary_constraints (${cols.join(", ")}) VALUES (${placeholders})
         ON CONFLICT (assessment_id) DO UPDATE SET ${updates}`,
        Object.values(payload),
      );
    }),
  );

const SaveChainNodeInput = z.object({
  assessmentId: z.string().uuid(),
  id: z.string().uuid().optional(),
  step_key: z.string().optional(),
  content: z.string(),
  sort_order: z.number().optional(),
});

export const saveChainNode = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => SaveChainNodeInput.parse(d))
  .handler(({ data, context }) =>
    withUser(context.userId, async (client) => {
      if (data.id) {
        await client.query(
          "UPDATE public.cap_chain_nodes SET content = $1, modified_by = $2 WHERE id = $3",
          [data.content, context.userId, data.id],
        );
        return;
      }
      await client.query(
        `INSERT INTO public.cap_chain_nodes
           (assessment_id, step_key, content, sort_order, created_by, modified_by)
         VALUES ($1,$2,$3,$4,$5,$5)`,
        [
          data.assessmentId,
          data.step_key,
          data.content,
          data.sort_order,
          context.userId,
        ],
      );
    }),
  );
