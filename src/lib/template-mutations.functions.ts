import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/auth-middleware";
import { withUser } from "@/lib/db.server";
import type { PoolClient } from "pg";

function insertReturningId(client: PoolClient, table: string, values: Record<string, unknown>) {
  const cols = Object.keys(values);
  const placeholders = cols.map((_, i) => `$${i + 1}`).join(", ");
  return client.query(
    `INSERT INTO public.${table} (${cols.join(", ")}) VALUES (${placeholders}) RETURNING id`,
    Object.values(values),
  );
}

function updateById(client: PoolClient, table: string, id: string, values: Record<string, unknown>) {
  const cols = Object.keys(values);
  const setClause = cols.map((c, i) => `${c} = $${i + 1}`).join(", ");
  return client.query(`UPDATE public.${table} SET ${setClause} WHERE id = $${cols.length + 1}`, [
    ...Object.values(values),
    id,
  ]);
}

const SaveTemplateInput = z.object({
  id: z.string().uuid().optional(),
  values: z.record(z.any()),
  initialVersion: z.number().optional(),
});

export const saveTemplate = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => SaveTemplateInput.parse(d))
  .handler(({ data, context }) =>
    withUser(context.userId, async (client) => {
      if (data.id) {
        await updateById(client, "assessment_templates", data.id, data.values);
        return data.id;
      }
      const { rows } = await insertReturningId(client, "assessment_templates", {
        ...data.values,
        status: "draft",
        archived: false,
      });
      const templateId = rows[0].id as string;
      await client.query(
        `INSERT INTO public.assessment_template_versions (template_id, version, status, notes)
         VALUES ($1, $2, 'draft', 'Initial draft')`,
        [templateId, Math.max(1, Math.round(Number(data.initialVersion ?? 1)))],
      );
      await client.query(
        `INSERT INTO public.audit_logs (entity_type, entity_id, actor_id, action, details)
         VALUES ('assessment_template', $1, $2, 'template.created', $3)`,
        [
          templateId,
          context.userId,
          JSON.stringify({ name: data.values.name, template_code: data.values.template_code }),
        ],
      );
      return templateId;
    }),
  );

const ArchiveTemplateInput = z.object({ id: z.string().uuid(), archived: z.boolean() });

export const archiveTemplate = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => ArchiveTemplateInput.parse(d))
  .handler(({ data, context }) =>
    withUser(context.userId, async (client) => {
      await client.query(
        "UPDATE public.assessment_templates SET archived = $1, status = $2 WHERE id = $3",
        [data.archived, data.archived ? "archived" : "draft", data.id],
      );
      await client.query(
        `INSERT INTO public.audit_logs (entity_type, entity_id, actor_id, action)
         VALUES ('assessment_template', $1, $2, $3)`,
        [data.id, context.userId, data.archived ? "template.archived" : "template.restored"],
      );
    }),
  );

const DuplicateTemplateInput = z.object({
  templateValues: z.record(z.any()),
  sourceTemplateId: z.string().uuid(),
  sourceVersion: z.number(),
  versionNotes: z.string(),
  ownerOrganizationId: z.string().uuid().nullable().optional(),
  categories: z.array(
    z.object({
      code: z.string(),
      name: z.string(),
      description: z.string().nullable().optional(),
      weight: z.number(),
      sort_order: z.number(),
      archived: z.boolean().optional(),
      questions: z.array(z.record(z.any())),
    }),
  ),
});

export const duplicateTemplate = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => DuplicateTemplateInput.parse(d))
  .handler(({ data, context }) =>
    withUser(context.userId, async (client) => {
      const { rows: templateRows } = await insertReturningId(client, "assessment_templates", {
        ...data.templateValues,
        owner_organization_id: data.ownerOrganizationId ?? null,
        status: "draft",
        archived: false,
      });
      const templateId = templateRows[0].id as string;

      const { rows: versionRows } = await insertReturningId(client, "assessment_template_versions", {
        template_id: templateId,
        version: 1,
        status: "draft",
        notes: data.versionNotes,
      });
      const versionId = versionRows[0].id as string;

      for (const category of data.categories) {
        const { rows: catRows } = await insertReturningId(client, "assessment_categories", {
          template_version_id: versionId,
          code: category.code,
          name: category.name,
          description: category.description ?? null,
          weight: category.weight,
          sort_order: category.sort_order,
          archived: category.archived ?? false,
        });
        const categoryId = catRows[0].id as string;

        for (const question of category.questions) {
          await insertReturningId(client, "assessment_questions", {
            ...question,
            category_id: categoryId,
          });
        }
      }

      await client.query(
        `INSERT INTO public.audit_logs (entity_type, entity_id, actor_id, action, details)
         VALUES ('assessment_template', $1, $2, 'template.duplicated', $3)`,
        [
          templateId,
          context.userId,
          JSON.stringify({ source_template_id: data.sourceTemplateId, source_version: data.sourceVersion }),
        ],
      );

      return templateId;
    }),
  );

const VersionIdInput = z.object({ versionId: z.string().uuid(), notes: z.string().nullable().optional() });

export const createTemplateVersion = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => VersionIdInput.parse(d))
  .handler(({ data, context }) =>
    withUser(context.userId, async (client) => {
      const { rows } = await client.query(
        "SELECT public.clone_template_version($1, $2) AS id",
        [data.versionId, data.notes ?? null],
      );
      return rows[0].id as string;
    }),
  );

const PublishVersionInput = z.object({ versionId: z.string().uuid() });

export const publishTemplateVersion = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => PublishVersionInput.parse(d))
  .handler(({ data, context }) =>
    withUser(context.userId, (client) =>
      client.query("SELECT public.publish_template_version($1)", [data.versionId]),
    ),
  );

const DeleteVersionInput = z.object({ versionId: z.string().uuid() });

export const deleteDraftVersion = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => DeleteVersionInput.parse(d))
  .handler(({ data, context }) =>
    withUser(context.userId, (client) =>
      client.query("DELETE FROM public.assessment_template_versions WHERE id = $1", [data.versionId]),
    ),
  );

const SaveCategoryInput = z.object({
  id: z.string().uuid().optional(),
  values: z.record(z.any()),
});

export const saveCategory = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => SaveCategoryInput.parse(d))
  .handler(({ data, context }) =>
    withUser(context.userId, async (client) => {
      if (data.id) {
        await updateById(client, "assessment_categories", data.id, data.values);
      } else {
        await insertReturningId(client, "assessment_categories", data.values);
      }
    }),
  );

const CategoryRowActionInput = z.object({
  categoryId: z.string().uuid(),
  action: z.enum(["delete", "archive", "restore", "swap"]),
  swapWithId: z.string().uuid().optional(),
  swapWithSortOrder: z.number().optional(),
  ownSortOrder: z.number().optional(),
});

export const categoryRowAction = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => CategoryRowActionInput.parse(d))
  .handler(({ data, context }) =>
    withUser(context.userId, async (client) => {
      if (data.action === "delete") {
        await client.query("DELETE FROM public.assessment_categories WHERE id = $1", [data.categoryId]);
        return;
      }
      if (data.action === "archive" || data.action === "restore") {
        await client.query("UPDATE public.assessment_categories SET archived = $1 WHERE id = $2", [
          data.action === "archive",
          data.categoryId,
        ]);
        return;
      }
      if (data.action === "swap" && data.swapWithId) {
        await client.query("UPDATE public.assessment_categories SET sort_order = $1 WHERE id = $2", [
          data.swapWithSortOrder,
          data.categoryId,
        ]);
        await client.query("UPDATE public.assessment_categories SET sort_order = $1 WHERE id = $2", [
          data.ownSortOrder,
          data.swapWithId,
        ]);
      }
    }),
  );

const SaveQuestionInput = z.object({
  id: z.string().uuid().optional(),
  values: z.record(z.any()),
});

export const saveQuestion = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => SaveQuestionInput.parse(d))
  .handler(({ data, context }) =>
    withUser(context.userId, async (client) => {
      if (data.id) {
        await updateById(client, "assessment_questions", data.id, data.values);
      } else {
        await insertReturningId(client, "assessment_questions", data.values);
      }
    }),
  );

const QuestionRowActionInput = z.object({
  questionId: z.string().uuid(),
  action: z.enum(["delete", "archive", "restore", "duplicate", "swap"]),
  duplicateValues: z.record(z.any()).optional(),
  swapWithId: z.string().uuid().optional(),
  swapWithSortOrder: z.number().optional(),
  ownSortOrder: z.number().optional(),
});

export const questionRowAction = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => QuestionRowActionInput.parse(d))
  .handler(({ data, context }) =>
    withUser(context.userId, async (client) => {
      if (data.action === "delete") {
        await client.query("DELETE FROM public.assessment_questions WHERE id = $1", [data.questionId]);
        return;
      }
      if (data.action === "archive" || data.action === "restore") {
        await client.query("UPDATE public.assessment_questions SET archived = $1 WHERE id = $2", [
          data.action === "archive",
          data.questionId,
        ]);
        return;
      }
      if (data.action === "duplicate" && data.duplicateValues) {
        await insertReturningId(client, "assessment_questions", data.duplicateValues);
        return;
      }
      if (data.action === "swap" && data.swapWithId) {
        await client.query("UPDATE public.assessment_questions SET sort_order = $1 WHERE id = $2", [
          data.swapWithSortOrder,
          data.questionId,
        ]);
        await client.query("UPDATE public.assessment_questions SET sort_order = $1 WHERE id = $2", [
          data.ownSortOrder,
          data.swapWithId,
        ]);
      }
    }),
  );
