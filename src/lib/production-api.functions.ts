import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/auth-middleware";
import { withUser } from "@/lib/db.server";
import { assertColumnsAllowed } from "@/lib/column-allowlist";

const optionalId = z.object({ id: z.string().uuid().optional() });

export const fetchJobs = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => optionalId.parse(d))
  .handler(({ data, context }) =>
    withUser(context.userId, async (client) => {
      const { rows } = data.id
        ? await client.query(
            "SELECT * FROM public.jobs WHERE organization_id = $1 ORDER BY created_at DESC",
            [data.id],
          )
        : await client.query("SELECT * FROM public.jobs ORDER BY created_at DESC");
      return rows;
    }),
  );

const jobIdInput = z.object({ jobId: z.string().uuid() });

export const fetchJob = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => jobIdInput.parse(d))
  .handler(({ data, context }) =>
    withUser(context.userId, async (client) => {
      const { rows } = await client.query("SELECT * FROM public.jobs WHERE id = $1", [data.jobId]);
      return rows[0] ?? null;
    }),
  );

/** Every child record the job console renders, fetched in one round trip. */
export const fetchJobDetail = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => jobIdInput.parse(d))
  .handler(({ data, context }) =>
    withUser(context.userId, async (client) => {
      const jobId = data.jobId;
      const [
        review,
        exceptions,
        plans,
        planReviews,
        operations,
        camJob,
        checks,
        simulations,
        approvals,
        posts,
        sheets,
        release,
        proveOuts,
        files,
      ] = await Promise.all([
        client.query("SELECT * FROM public.intake_reviews WHERE job_id = $1", [jobId]),
        client.query(
          "SELECT * FROM public.intake_exceptions WHERE job_id = $1 ORDER BY created_at DESC",
          [jobId],
        ),
        client.query("SELECT * FROM public.ai_plans WHERE job_id = $1 ORDER BY generated_at DESC", [
          jobId,
        ]),
        client.query(
          "SELECT * FROM public.plan_reviews WHERE job_id = $1 ORDER BY reviewed_at DESC",
          [jobId],
        ),
        client.query(
          "SELECT * FROM public.operations WHERE job_id = $1 ORDER BY setup_number, sequence",
          [jobId],
        ),
        client.query("SELECT * FROM public.mastercam_jobs WHERE job_id = $1", [jobId]),
        client.query(
          "SELECT * FROM public.automated_checks WHERE job_id = $1 ORDER BY run_at DESC",
          [jobId],
        ),
        client.query(
          "SELECT * FROM public.simulations WHERE job_id = $1 ORDER BY created_at DESC",
          [jobId],
        ),
        client.query(
          "SELECT * FROM public.programmer_approvals WHERE job_id = $1 ORDER BY approved_at DESC",
          [jobId],
        ),
        client.query(
          "SELECT * FROM public.post_records WHERE job_id = $1 ORDER BY posted_at DESC",
          [jobId],
        ),
        client.query(
          "SELECT * FROM public.setup_sheets WHERE job_id = $1 ORDER BY created_at DESC",
          [jobId],
        ),
        client.query("SELECT * FROM public.release_packages WHERE job_id = $1", [jobId]),
        client.query(
          "SELECT * FROM public.prove_out_results WHERE job_id = $1 ORDER BY created_at DESC",
          [jobId],
        ),
        client.query("SELECT * FROM public.job_files WHERE job_id = $1 ORDER BY created_at", [jobId]),
      ]);

      return {
        review: review.rows[0] ?? null,
        exceptions: exceptions.rows,
        plans: plans.rows,
        planReviews: planReviews.rows,
        operations: operations.rows,
        camJob: camJob.rows[0] ?? null,
        checks: checks.rows,
        simulations: simulations.rows,
        approvals: approvals.rows,
        posts: posts.rows,
        sheets: sheets.rows,
        release: release.rows[0] ?? null,
        proveOuts: proveOuts.rows,
        files: files.rows,
      };
    }),
  );

export const fetchMachineProfiles = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => optionalId.parse(d))
  .handler(({ context }) =>
    withUser(context.userId, async (client) => {
      const { rows } = await client.query("SELECT * FROM public.machine_profiles ORDER BY make");
      return rows;
    }),
  );

export const fetchToolingProfiles = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(({ context }) =>
    withUser(context.userId, async (client) => {
      const { rows } = await client.query(
        "SELECT * FROM public.tooling_profiles ORDER BY tool_number",
      );
      return rows;
    }),
  );

export const fetchPostProcessors = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(({ context }) =>
    withUser(context.userId, async (client) => {
      const { rows } = await client.query("SELECT * FROM public.post_processors ORDER BY name");
      return rows;
    }),
  );

export const fetchProgrammerCapabilities = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(({ context }) =>
    withUser(context.userId, async (client) => {
      const { rows } = await client.query("SELECT * FROM public.programmer_capabilities");
      return rows;
    }),
  );

const AdvanceStatusInput = z.object({
  jobId: z.string().uuid(),
  status: z.string(),
  action: z.string(),
  detail: z.string().nullable().optional(),
  organizationId: z.string().uuid().nullable().optional(),
  actorName: z.string().nullable().optional(),
  patch: z.record(z.any()).optional(),
});

export const advanceStatus = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => AdvanceStatusInput.parse(d))
  .handler(({ data, context }) =>
    withUser(context.userId, async (client) => {
      const patch = { status: data.status, ...(data.patch ?? {}) };
      const cols = Object.keys(patch);
      assertColumnsAllowed("jobs", cols);
      const setClause = cols.map((c, i) => `${c} = $${i + 1}`).join(", ");
      await client.query(`UPDATE public.jobs SET ${setClause} WHERE id = $${cols.length + 1}`, [
        ...Object.values(patch),
        data.jobId,
      ]);
    }),
  );
