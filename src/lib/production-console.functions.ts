/**
 * Server functions backing the production job console
 * (src/routes/_authenticated/production.jobs.$jobId.tsx), which previously
 * wrote directly to Supabase from the browser.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/auth-middleware";
import { withUser } from "@/lib/db.server";

const ALLOWED_TABLES = new Set([
  "jobs",
  "intake_reviews",
  "intake_exceptions",
  "plan_reviews",
  "mastercam_jobs",
  "programmer_approvals",
  "post_records",
  "setup_sheets",
  "release_packages",
  "prove_out_results",
  "simulations",
  "automated_checks",
]);

function assertAllowed(table: string) {
  if (!ALLOWED_TABLES.has(table)) throw new Error(`Table "${table}" is not allowed here.`);
}

const UpsertInput = z.object({
  table: z.string(),
  id: z.string().uuid().optional(),
  values: z.record(z.any()),
});

/** Update-by-id if `id` is given, otherwise insert. Returns the row id. */
export const productionUpsert = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => UpsertInput.parse(d))
  .handler(({ data, context }) => {
    assertAllowed(data.table);
    return withUser(context.userId, async (client) => {
      if (data.id) {
        const cols = Object.keys(data.values);
        const setClause = cols.map((c, i) => `${c} = $${i + 1}`).join(", ");
        await client.query(`UPDATE public.${data.table} SET ${setClause} WHERE id = $${cols.length + 1}`, [
          ...Object.values(data.values),
          data.id,
        ]);
        return data.id;
      }
      const cols = Object.keys(data.values);
      const placeholders = cols.map((_, i) => `$${i + 1}`).join(", ");
      const { rows } = await client.query(
        `INSERT INTO public.${data.table} (${cols.join(", ")}) VALUES (${placeholders}) RETURNING id`,
        Object.values(data.values),
      );
      return rows[0].id as string;
    });
  });

const CreateJobInput = z.object({ values: z.record(z.any()) });

export const createJob = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => CreateJobInput.parse(d))
  .handler(({ data, context }) =>
    withUser(context.userId, async (client) => {
      const cols = Object.keys(data.values);
      const placeholders = cols.map((_, i) => `$${i + 1}`).join(", ");
      const { rows } = await client.query(
        `INSERT INTO public.jobs (${cols.join(", ")}) VALUES (${placeholders}) RETURNING id`,
        Object.values(data.values),
      );
      return rows[0] as { id: string };
    }),
  );

const ReplaceAutomatedChecksInput = z.object({
  jobId: z.string().uuid(),
  rows: z.array(z.record(z.any())),
});

/** Clears existing automated_checks for a job and inserts the fresh run. */
export const replaceAutomatedChecks = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => ReplaceAutomatedChecksInput.parse(d))
  .handler(({ data, context }) =>
    withUser(context.userId, async (client) => {
      await client.query("DELETE FROM public.automated_checks WHERE job_id = $1", [data.jobId]);
      for (const row of data.rows) {
        const cols = Object.keys(row);
        const placeholders = cols.map((_, i) => `$${i + 1}`).join(", ");
        await client.query(
          `INSERT INTO public.automated_checks (${cols.join(", ")}) VALUES (${placeholders})`,
          Object.values(row),
        );
      }
    }),
  );
