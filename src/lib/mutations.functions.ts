import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/auth-middleware";
import { withUser } from "@/lib/db.server";
import { assertColumnsAllowed } from "@/lib/column-allowlist";
import {
  assertProductAllowed,
  assertProductAllowedForFinding,
  assertProductAllowedForCorrectiveAction,
  assertProductAllowedForImprovementProject,
} from "@/lib/product-access-check.server";
import {
  captureFromFinding,
  captureFromCorrectiveAction,
  captureFromProject,
} from "@/lib/intelligence-capture.server";

async function upsert(
  client: import("pg").PoolClient,
  table: string,
  id: string | undefined,
  values: Record<string, unknown>,
): Promise<void> {
  const cols = Object.keys(values);
  // Security boundary: `table` here is always a fixed literal the caller
  // passes in (never client input), but `cols` comes straight from a
  // client-supplied JSON object's keys and was previously spliced
  // unescaped into the SQL text below as column identifiers -- a real,
  // exploitable SQL injection. assertColumnsAllowed enforces that every
  // key is a real, known column of `table` before it ever reaches SQL.
  assertColumnsAllowed(table, cols);
  if (id) {
    const setClause = cols.map((c, i) => `${c} = $${i + 1}`).join(", ");
    await client.query(
      `UPDATE public.${table} SET ${setClause} WHERE id = $${cols.length + 1}`,
      [...Object.values(values), id],
    );
    return;
  }
  const placeholders = cols.map((_, i) => `$${i + 1}`).join(", ");
  await client.query(
    `INSERT INTO public.${table} (${cols.join(", ")}) VALUES (${placeholders})`,
    Object.values(values),
  );
}

const OrgInput = z.object({
  id: z.string().uuid().optional(),
  values: z.record(z.any()),
});

export const saveOrganization = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => OrgInput.parse(d))
  .handler(({ data, context }) =>
    withUser(context.userId, (client) =>
      upsert(client, "organizations", data.id, data.values),
    ),
  );

const ArchiveInput = z.object({ id: z.string().uuid(), archived: z.boolean() });

export const archiveOrganization = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => ArchiveInput.parse(d))
  .handler(async ({ data, context }) => {
    await withUser(context.userId, (client) =>
      client.query(
        "UPDATE public.organizations SET archived = $1, status = $2 WHERE id = $3",
        [data.archived, data.archived ? "archived" : "active", data.id],
      ),
    );
  });

const FacilityInput = z.object({
  id: z.string().uuid().optional(),
  values: z.record(z.any()),
});

export const saveFacility = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => FacilityInput.parse(d))
  .handler(({ data, context }) =>
    withUser(context.userId, (client) =>
      upsert(client, "facilities", data.id, data.values),
    ),
  );

export const archiveFacility = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => ArchiveInput.parse(d))
  .handler(async ({ data, context }) => {
    await withUser(context.userId, (client) =>
      client.query(
        "UPDATE public.facilities SET archived = $1, status = $2 WHERE id = $3",
        [data.archived, data.archived ? "archived" : "active", data.id],
      ),
    );
  });

const UpdateFindingInput = z.object({
  id: z.string().uuid(),
  values: z.record(z.any()),
  // Per Phase A: consent captured at the moment of closing, not a static
  // setting. Only meaningful (and only acted on) when values.status is
  // transitioning to 'closed' or 'accepted_risk' — see the handler below.
  contributeToIntelligence: z.boolean().optional(),
});

export const updateFinding = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => UpdateFindingInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertProductAllowedForFinding(context.userId, data.id, "assessment");
    await withUser(context.userId, (client) =>
      upsert(client, "findings", data.id, data.values),
    );

    const closingStatuses = ["closed", "accepted_risk"];
    if (
      data.contributeToIntelligence &&
      closingStatuses.includes(data.values["status"])
    ) {
      await captureFromFinding(context.userId, data.id);
    }
  });

const ProjectIdsInput = z.object({ projectIds: z.array(z.string().uuid()) });

export const fetchProjectFindings = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => ProjectIdsInput.parse(d))
  .handler(({ data, context }) =>
    withUser(context.userId, async (client) => {
      if (data.projectIds.length === 0) return [];
      const { rows } = await client.query(
        "SELECT id, project_id, finding_id FROM public.project_findings WHERE project_id = ANY($1)",
        [data.projectIds],
      );
      return rows;
    }),
  );

const ToggleProjectFindingInput = z.object({
  projectId: z.string().uuid(),
  findingId: z.string().uuid(),
  linked: z.boolean(),
});

export const toggleProjectFinding = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => ToggleProjectFindingInput.parse(d))
  .handler(async ({ data, context }) => {
    await withUser(context.userId, (client) =>
      data.linked
        ? client.query(
            "DELETE FROM public.project_findings WHERE project_id = $1 AND finding_id = $2",
            [data.projectId, data.findingId],
          )
        : client.query(
            "INSERT INTO public.project_findings (project_id, finding_id) VALUES ($1, $2)",
            [data.projectId, data.findingId],
          ),
    );
  });

// ---------------------------------------------------------------------
// Corrective actions and improvement projects previously had no write
// path at all in the application — only the read-only SELECT queries in
// api.functions.ts existed. These are their first create/update
// capability, built alongside the intelligence-capture wiring rather
// than as a separate step, per the confirmed scope for this phase.
// ---------------------------------------------------------------------

const SaveCorrectiveActionInput = z.object({
  id: z.string().uuid().optional(),
  values: z.record(z.any()),
  contributeToIntelligence: z.boolean().optional(),
});

export const saveCorrectiveAction = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => SaveCorrectiveActionInput.parse(d))
  .handler(async ({ data, context }) => {
    if (data.id) {
      await assertProductAllowedForCorrectiveAction(context.userId, data.id, "assessment");
    } else {
      const findingId = data.values["finding_id"];
      if (typeof findingId !== "string") {
        throw new Error("finding_id is required to create a corrective action.");
      }
      await assertProductAllowedForFinding(context.userId, findingId, "assessment");
    }
    const { rows } = await withUser(context.userId, async (client) => {
      if (data.id) {
        await upsert(client, "corrective_actions", data.id, data.values);
        return { rows: [{ id: data.id }] };
      }
      const cols = Object.keys(data.values);
      assertColumnsAllowed("corrective_actions", cols);
      const placeholders = cols.map((_, i) => `$${i + 1}`).join(", ");
      return client.query(
        `INSERT INTO public.corrective_actions (${cols.join(", ")}) VALUES (${placeholders}) RETURNING id`,
        Object.values(data.values),
      );
    });
    const actionId = data.id ?? rows[0]?.id;

    if (
      data.contributeToIntelligence &&
      data.values["status"] === "closed" &&
      actionId
    ) {
      await captureFromCorrectiveAction(context.userId, actionId);
    }
    return { id: actionId };
  });

const DeleteCorrectiveActionInput = z.object({ id: z.string().uuid() });

export const deleteCorrectiveAction = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => DeleteCorrectiveActionInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertProductAllowedForCorrectiveAction(context.userId, data.id, "assessment");
    await withUser(context.userId, (client) =>
      client.query("DELETE FROM public.corrective_actions WHERE id = $1", [
        data.id,
      ]),
    );
  });

const SaveImprovementProjectInput = z.object({
  id: z.string().uuid().optional(),
  values: z.record(z.any()),
  contributeToIntelligence: z.boolean().optional(),
});

export const saveImprovementProject = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => SaveImprovementProjectInput.parse(d))
  .handler(async ({ data, context }) => {
    if (data.id) {
      await assertProductAllowedForImprovementProject(context.userId, data.id, "assessment");
    } else {
      const organizationId = data.values["organization_id"];
      if (typeof organizationId !== "string") {
        throw new Error("organization_id is required to create an improvement project.");
      }
      await assertProductAllowed(context.userId, organizationId, "assessment");
    }
    const { rows } = await withUser(context.userId, async (client) => {
      if (data.id) {
        await upsert(client, "improvement_projects", data.id, data.values);
        return { rows: [{ id: data.id }] };
      }
      const cols = Object.keys(data.values);
      assertColumnsAllowed("improvement_projects", cols);
      const placeholders = cols.map((_, i) => `$${i + 1}`).join(", ");
      return client.query(
        `INSERT INTO public.improvement_projects (${cols.join(", ")}) VALUES (${placeholders}) RETURNING id`,
        Object.values(data.values),
      );
    });
    const projectId = data.id ?? rows[0]?.id;

    if (
      data.contributeToIntelligence &&
      data.values["status"] === "complete" &&
      projectId
    ) {
      await captureFromProject(context.userId, projectId);
    }
    return { id: projectId };
  });

const DeleteImprovementProjectInput = z.object({ id: z.string().uuid() });

export const deleteImprovementProject = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => DeleteImprovementProjectInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertProductAllowedForImprovementProject(context.userId, data.id, "assessment");
    await withUser(context.userId, (client) =>
      client.query("DELETE FROM public.improvement_projects WHERE id = $1", [
        data.id,
      ]),
    );
  });
