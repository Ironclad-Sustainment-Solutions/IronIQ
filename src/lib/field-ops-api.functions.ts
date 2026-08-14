import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/auth-middleware";
import { withUser } from "@/lib/db.server";

const ALLOWED_TABLES = new Set([
  "field_production_events",
  "field_delays",
  "field_cause_nodes",
  "field_evidence_items",
  "field_sme_dependencies",
  "field_baseline_metrics",
  "field_pilots",
  "field_opportunities",
  "field_pilot_metrics",
  "field_event_marks",
]);

function assertAllowed(table: string) {
  if (!ALLOWED_TABLES.has(table)) throw new Error(`Table "${table}" is not allowed here.`);
}

const fieldIdInput = z.object({ fieldId: z.string().uuid() });

export const fetchFieldOps = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => fieldIdInput.parse(d))
  .handler(({ data, context }) =>
    withUser(context.userId, async (client) => {
      const id = data.fieldId;
      const [events, delays, causes, evidence, smes, metrics, pilots, opportunities] = await Promise.all([
        client.query(
          "SELECT * FROM public.field_production_events WHERE field_assessment_id = $1 ORDER BY occurred_at DESC",
          [id],
        ),
        client.query(
          "SELECT * FROM public.field_delays WHERE field_assessment_id = $1 ORDER BY created_at DESC",
          [id],
        ),
        client.query(
          "SELECT * FROM public.field_cause_nodes WHERE field_assessment_id = $1 ORDER BY sort_order",
          [id],
        ),
        client.query(
          "SELECT * FROM public.field_evidence_items WHERE field_assessment_id = $1 ORDER BY captured_at DESC",
          [id],
        ),
        client.query(
          "SELECT * FROM public.field_sme_dependencies WHERE field_assessment_id = $1 ORDER BY created_at",
          [id],
        ),
        client.query(
          "SELECT * FROM public.field_baseline_metrics WHERE field_assessment_id = $1 ORDER BY sort_order",
          [id],
        ),
        client.query(
          "SELECT * FROM public.field_pilots WHERE field_assessment_id = $1 ORDER BY created_at",
          [id],
        ),
        client.query(
          "SELECT * FROM public.field_opportunities WHERE field_assessment_id = $1 ORDER BY sort_order",
          [id],
        ),
      ]);

      const eventIds = events.rows.map((e) => e.id as string);
      const marks = eventIds.length
        ? await client.query(
            "SELECT * FROM public.field_event_marks WHERE event_id = ANY($1) ORDER BY marked_at",
            [eventIds],
          )
        : { rows: [] };
      const pilotIds = pilots.rows.map((p) => p.id as string);
      const pilotMetrics = pilotIds.length
        ? await client.query(
            "SELECT * FROM public.field_pilot_metrics WHERE pilot_id = ANY($1) ORDER BY sort_order",
            [pilotIds],
          )
        : { rows: [] };

      return {
        events: events.rows,
        marks: marks.rows,
        delays: delays.rows,
        causes: causes.rows,
        evidence: evidence.rows,
        smes: smes.rows,
        metrics: metrics.rows,
        pilots: pilots.rows,
        pilotMetrics: pilotMetrics.rows,
        opportunities: opportunities.rows,
      };
    }),
  );

const RowAddInput = z.object({
  table: z.string(),
  parentColumn: z.string(),
  parentId: z.string().uuid(),
  values: z.record(z.any()),
  stampCreatedBy: z.boolean().optional(),
});

export const rowAdd = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => RowAddInput.parse(d))
  .handler(({ data, context }) => {
    assertAllowed(data.table);
    return withUser(context.userId, async (client) => {
      const payload: Record<string, unknown> = { [data.parentColumn]: data.parentId, ...data.values };
      if (data.stampCreatedBy) payload.created_by = context.userId;
      const cols = Object.keys(payload);
      const placeholders = cols.map((_, i) => `$${i + 1}`).join(", ");
      const { rows } = await client.query(
        `INSERT INTO public.${data.table} (${cols.join(", ")}) VALUES (${placeholders}) RETURNING *`,
        Object.values(payload),
      );
      return rows[0];
    });
  });

const RowUpdateInput = z.object({ table: z.string(), id: z.string().uuid(), values: z.record(z.any()) });

export const rowUpdate = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => RowUpdateInput.parse(d))
  .handler(({ data, context }) => {
    assertAllowed(data.table);
    return withUser(context.userId, async (client) => {
      const cols = Object.keys(data.values);
      if (cols.length === 0) return;
      const setClause = cols.map((c, i) => `${c} = $${i + 1}`).join(", ");
      await client.query(`UPDATE public.${data.table} SET ${setClause} WHERE id = $${cols.length + 1}`, [
        ...Object.values(data.values),
        data.id,
      ]);
    });
  });

const RowRemoveInput = z.object({ table: z.string(), id: z.string().uuid() });

export const rowRemove = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => RowRemoveInput.parse(d))
  .handler(({ data, context }) => {
    assertAllowed(data.table);
    return withUser(context.userId, (client) =>
      client.query(`DELETE FROM public.${data.table} WHERE id = $1`, [data.id]),
    );
  });

const MarkEventInput = z.object({
  eventId: z.string().uuid(),
  markCode: z.string(),
  existing: z
    .object({
      id: z.string().uuid(),
      marked_at: z.string(),
      original_at: z.string().nullable().optional(),
      edit_history: z.array(z.record(z.any())).nullable().optional(),
    })
    .optional(),
  at: z.string().optional(),
});

export const markEvent = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => MarkEventInput.parse(d))
  .handler(({ data, context }) =>
    withUser(context.userId, async (client) => {
      const stamp = data.at ? new Date(data.at).toISOString() : new Date().toISOString();
      if (data.existing) {
        const history = [
          ...(data.existing.edit_history ?? []),
          { at: stamp, from: data.existing.marked_at, by: context.userId },
        ];
        await client.query(
          `UPDATE public.field_event_marks SET marked_at = $1, original_at = $2, edit_history = $3 WHERE id = $4`,
          [
            stamp,
            data.existing.original_at ?? data.existing.marked_at,
            JSON.stringify(history),
            data.existing.id,
          ],
        );
        return;
      }
      await client.query(
        `INSERT INTO public.field_event_marks (event_id, mark_code, marked_at, created_by)
         VALUES ($1,$2,$3,$4)`,
        [data.eventId, data.markCode, stamp, context.userId],
      );
    }),
  );
