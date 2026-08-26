/**
 * Template authoring write-paths. All calls go through server functions
 * (src/lib/template-mutations.functions.ts) which enforce RLS server-side.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import * as fn from "@/lib/template-mutations.functions";
import { logAudit } from "./api";
import type {
  AssessmentCategory,
  AssessmentQuestion,
  AssessmentTemplate,
  AssessmentTemplateVersion,
  EvidenceType,
  FindingSeverity,
} from "./domain";
import {
  buildVersionCopy,
  validateCategoryInput,
  validateQuestionInput,
} from "./template-validation";

const LIBRARY_KEYS = [
  "template-library",
  "templates",
  "template-content",
  "audit-log",
];

function useInvalidator() {
  const queryClient = useQueryClient();
  return () =>
    LIBRARY_KEYS.forEach((key) =>
      queryClient.invalidateQueries({ queryKey: [key] }),
    );
}

export interface TemplateInput {
  id?: string;
  name: string;
  template_code: string;
  description?: string | null;
  intended_use?: string | null;
  industry?: string | null;
  assessment_type?: string | null;
  owner_organization_id?: string | null;
  /** Only used when creating. */
  initial_version?: number;
}

export function useSaveTemplate() {
  const invalidate = useInvalidator();
  return useMutation({
    mutationFn: async (input: TemplateInput) => {
      if (!input.name?.trim()) throw new Error("Template name is required.");
      if (!input.template_code?.trim())
        throw new Error("Template ID is required.");

      const values = {
        name: input.name.trim(),
        template_code: input.template_code.trim(),
        description: input.description ?? null,
        intended_use: input.intended_use ?? null,
        industry: input.industry ?? null,
        assessment_type: input.assessment_type ?? null,
        owner_organization_id: input.owner_organization_id ?? null,
      };

      return fn.saveTemplate({
        data: { id: input.id, values, initialVersion: input.initial_version },
      });
    },
    onSuccess: () => {
      invalidate();
      toast.success("Template saved");
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Could not save template"),
  });
}

export function useArchiveTemplate() {
  const invalidate = useInvalidator();
  return useMutation({
    mutationFn: async ({ id, archived }: { id: string; archived: boolean }) =>
      fn.archiveTemplate({ data: { id, archived } }),
    onSuccess: () => {
      invalidate();
      toast.success("Template updated");
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Could not update template"),
  });
}

/** Copies a template (and one of its versions) into a brand new draft template. */
export function useDuplicateTemplate() {
  const invalidate = useInvalidator();
  return useMutation({
    mutationFn: async ({
      template,
      version,
      categories,
      questions,
      ownerOrganizationId,
    }: {
      template: AssessmentTemplate;
      version: AssessmentTemplateVersion;
      categories: AssessmentCategory[];
      questions: AssessmentQuestion[];
      ownerOrganizationId?: string | null;
    }) => {
      const copy = buildVersionCopy({ version, categories, questions }, []);
      const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();

      return fn.duplicateTemplate({
        data: {
          templateValues: {
            name: `${template.name} (copy)`,
            template_code: `${template.template_code ?? "TPL"}-COPY-${suffix}`,
            description: template.description,
            intended_use: template.intended_use,
            industry: template.industry,
            assessment_type: template.assessment_type,
          },
          sourceTemplateId: template.id,
          sourceVersion: version.version,
          versionNotes: `Duplicated from ${template.name} v${version.version}`,
          ownerOrganizationId: ownerOrganizationId ?? null,
          categories: copy.categories,
        },
      });
    },
    onSuccess: () => {
      invalidate();
      toast.success("Template duplicated as a new draft");
    },
    onError: (e) =>
      toast.error(
        e instanceof Error ? e.message : "Could not duplicate template",
      ),
  });
}

export function useCreateTemplateVersion() {
  const invalidate = useInvalidator();
  return useMutation({
    mutationFn: async ({
      versionId,
      notes,
    }: {
      versionId: string;
      notes?: string;
    }) =>
      fn.createTemplateVersion({ data: { versionId, notes: notes ?? null } }),
    onSuccess: () => {
      invalidate();
      toast.success("New draft version created");
    },
    onError: (e) =>
      toast.error(
        e instanceof Error ? e.message : "Could not create a new version",
      ),
  });
}

export function usePublishTemplateVersion() {
  const invalidate = useInvalidator();
  return useMutation({
    mutationFn: async (versionId: string) =>
      fn.publishTemplateVersion({ data: { versionId } }),
    onSuccess: () => {
      invalidate();
      toast.success("Template version published and locked");
    },
    onError: (e) =>
      toast.error(
        e instanceof Error ? e.message : "Could not publish this version",
      ),
  });
}

export function useDeleteDraftVersion() {
  const invalidate = useInvalidator();
  return useMutation({
    mutationFn: async (version: AssessmentTemplateVersion) => {
      if (version.status === "published")
        throw new Error("Published versions cannot be deleted.");
      return fn.deleteDraftVersion({ data: { versionId: version.id } });
    },
    onSuccess: () => {
      invalidate();
      toast.success("Draft version deleted");
    },
    onError: (e) =>
      toast.error(
        e instanceof Error ? e.message : "Could not delete this version",
      ),
  });
}

export interface CategoryInput {
  id?: string;
  template_version_id: string;
  code: string;
  name: string;
  description?: string | null;
  weight: number;
  sort_order?: number;
  archived?: boolean;
}

export function useSaveCategory() {
  const invalidate = useInvalidator();
  return useMutation({
    mutationFn: async ({
      input,
      siblings,
    }: {
      input: CategoryInput;
      siblings: AssessmentCategory[];
    }) => {
      const errors = validateCategoryInput(input, siblings, input.id);
      if (errors.length) throw new Error(errors[0]);
      const { id, ...values } = input;
      const payload = {
        ...values,
        code: values.code.trim(),
        name: values.name.trim(),
        weight: Number(values.weight),
        sort_order: values.sort_order ?? siblings.length,
      };
      return fn.saveCategory({ data: { id, values: payload } });
    },
    onSuccess: () => {
      invalidate();
      toast.success("Category saved");
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Could not save category"),
  });
}

export function useCategoryRowAction() {
  const invalidate = useInvalidator();
  return useMutation({
    mutationFn: async ({
      category,
      action,
      siblings,
    }: {
      category: AssessmentCategory;
      action: "delete" | "archive" | "restore" | "up" | "down";
      siblings: AssessmentCategory[];
    }) => {
      if (action === "delete" || action === "archive" || action === "restore") {
        return fn.categoryRowAction({
          data: { categoryId: category.id, action },
        });
      }
      const ordered = [...siblings].sort((a, b) => a.sort_order - b.sort_order);
      const index = ordered.findIndex((c) => c.id === category.id);
      const swapWith = action === "up" ? index - 1 : index + 1;
      if (swapWith < 0 || swapWith >= ordered.length) return;
      const other = ordered[swapWith];
      return fn.categoryRowAction({
        data: {
          categoryId: category.id,
          action: "swap",
          swapWithId: other.id,
          swapWithSortOrder: other.sort_order,
          ownSortOrder: category.sort_order,
        },
      });
    },
    onSuccess: () => invalidate(),
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Could not update category"),
  });
}

export interface QuestionInput {
  id?: string;
  category_id: string;
  question_code: string;
  question_text: string;
  guidance_text?: string | null;
  weight: number;
  is_critical?: boolean;
  required_evidence?: EvidenceType | null;
  is_required?: boolean;
  allow_not_applicable?: boolean;
  auto_finding?: boolean;
  default_severity?: FindingSeverity;
  archived?: boolean;
  sort_order?: number;
}

export function useSaveQuestion() {
  const invalidate = useInvalidator();
  return useMutation({
    mutationFn: async ({
      input,
      versionQuestions,
      categoryQuestionCount,
    }: {
      input: QuestionInput;
      /** Every question in the template version — question IDs must be unique across it. */
      versionQuestions: AssessmentQuestion[];
      categoryQuestionCount: number;
    }) => {
      const errors = validateQuestionInput(input, versionQuestions, input.id);
      if (errors.length) throw new Error(errors[0]);
      const { id, ...values } = input;
      const payload = {
        ...values,
        question_code: values.question_code.trim(),
        question_text: values.question_text.trim(),
        weight: Number(values.weight),
        sort_order: values.sort_order ?? categoryQuestionCount,
      };
      return fn.saveQuestion({ data: { id, values: payload } });
    },
    onSuccess: () => {
      invalidate();
      toast.success("Question saved");
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Could not save question"),
  });
}

export function useQuestionRowAction() {
  const invalidate = useInvalidator();
  return useMutation({
    mutationFn: async ({
      question,
      action,
      siblings,
      versionQuestions,
    }: {
      question: AssessmentQuestion;
      action: "delete" | "duplicate" | "archive" | "restore" | "up" | "down";
      siblings: AssessmentQuestion[];
      versionQuestions: AssessmentQuestion[];
    }) => {
      if (action === "delete" || action === "archive" || action === "restore") {
        return fn.questionRowAction({
          data: { questionId: question.id, action },
        });
      }
      if (action === "duplicate") {
        let suffix = 2;
        const taken = new Set(
          versionQuestions.map((q) => q.question_code.toLowerCase()),
        );
        let code = `${question.question_code}-${suffix}`;
        while (taken.has(code.toLowerCase())) {
          suffix += 1;
          code = `${question.question_code}-${suffix}`;
        }
        return fn.questionRowAction({
          data: {
            questionId: question.id,
            action: "duplicate",
            duplicateValues: {
              category_id: question.category_id,
              question_code: code,
              question_text: question.question_text,
              guidance_text: question.guidance_text,
              weight: Number(question.weight),
              is_critical: question.is_critical,
              required_evidence: question.required_evidence,
              sort_order: siblings.length,
              is_required: question.is_required,
              allow_not_applicable: question.allow_not_applicable,
              auto_finding: question.auto_finding,
              default_severity: question.default_severity,
              archived: question.archived,
            },
          },
        });
      }
      const ordered = [...siblings].sort((a, b) => a.sort_order - b.sort_order);
      const index = ordered.findIndex((q) => q.id === question.id);
      const swapWith = action === "up" ? index - 1 : index + 1;
      if (swapWith < 0 || swapWith >= ordered.length) return;
      const other = ordered[swapWith];
      return fn.questionRowAction({
        data: {
          questionId: question.id,
          action: "swap",
          swapWithId: other.id,
          swapWithSortOrder: other.sort_order,
          ownSortOrder: question.sort_order,
        },
      });
    },
    onSuccess: () => invalidate(),
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Could not update question"),
  });
}
