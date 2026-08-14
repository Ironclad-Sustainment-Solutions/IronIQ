/**
 * Pure authoring/validation rules for assessment templates.
 * Kept free of React and Supabase so it can be unit tested directly.
 */

import type {
  AppRole,
  AssessmentCategory,
  AssessmentQuestion,
  AssessmentTemplate,
  AssessmentTemplateVersion,
  TemplateStatus,
} from "./domain";

export interface DraftCategoryInput {
  code: string;
  name: string;
  description?: string | null;
  weight: number;
}

export interface DraftQuestionInput {
  question_code: string;
  question_text: string;
  weight: number;
}

/** A template version can only be edited while it is a draft. */
export function isVersionEditable(status: TemplateStatus): boolean {
  return status === "draft";
}

export function sumCategoryWeights(categories: Pick<AssessmentCategory, "weight" | "archived">[]): number {
  const total = categories
    .filter((c) => !c.archived)
    .reduce((acc, c) => acc + Number(c.weight ?? 0), 0);
  return Math.round(total * 100) / 100;
}

export function nextVersionNumber(versions: Pick<AssessmentTemplateVersion, "version">[]): number {
  return versions.reduce((max, v) => Math.max(max, Number(v.version ?? 0)), 0) + 1;
}

export function validateCategoryInput(
  input: DraftCategoryInput,
  siblings: Pick<AssessmentCategory, "id" | "code">[],
  editingId?: string,
): string[] {
  const errors: string[] = [];
  if (!input.code?.trim()) errors.push("Category ID is required.");
  if (!input.name?.trim()) errors.push("Category name is required.");
  if (!(Number(input.weight) > 0)) errors.push("Category weight must be greater than zero.");
  const duplicate = siblings.some(
    (c) => c.id !== editingId && c.code.trim().toLowerCase() === input.code.trim().toLowerCase(),
  );
  if (duplicate) errors.push(`Category ID "${input.code}" is already used in this template version.`);
  return errors;
}

export function validateQuestionInput(
  input: DraftQuestionInput,
  siblings: Pick<AssessmentQuestion, "id" | "question_code">[],
  editingId?: string,
): string[] {
  const errors: string[] = [];
  if (!input.question_code?.trim()) errors.push("Question ID is required.");
  if (!input.question_text?.trim()) errors.push("Question text is required.");
  if (!(Number(input.weight) > 0)) errors.push("Question weight must be greater than zero.");
  const duplicate = siblings.some(
    (q) =>
      q.id !== editingId &&
      q.question_code.trim().toLowerCase() === input.question_code.trim().toLowerCase(),
  );
  if (duplicate) errors.push(`Question ID "${input.question_code}" is already used in this template version.`);
  return errors;
}

export interface PublishValidation {
  ok: boolean;
  weightTotal: number;
  checks: { label: string; passed: boolean; detail?: string }[];
  errors: string[];
}

/** Full pre-publication validation for a draft version. */
export function validateForPublish(
  categories: AssessmentCategory[],
  questions: AssessmentQuestion[],
): PublishValidation {
  const active = categories.filter((c) => !c.archived);
  const activeQuestions = questions.filter((q) => !q.archived);
  const weightTotal = sumCategoryWeights(categories);
  const errors: string[] = [];

  const hasCategory = active.length > 0;
  if (!hasCategory) errors.push("Add at least one category.");

  const weightsOk = weightTotal === 100;
  if (!weightsOk) errors.push(`Category weights must total exactly 100% (currently ${weightTotal}%).`);

  const emptyCategories = active.filter(
    (c) => !activeQuestions.some((q) => q.category_id === c.id),
  );
  if (emptyCategories.length)
    errors.push(
      `Every category needs at least one active question: ${emptyCategories.map((c) => c.code).join(", ")}.`,
    );

  const blankFields = activeQuestions.filter(
    (q) => !q.question_code?.trim() || !q.question_text?.trim(),
  );
  if (blankFields.length) errors.push(`${blankFields.length} question(s) are missing an ID or text.`);

  const badWeights = activeQuestions.filter((q) => !(Number(q.weight) > 0));
  if (badWeights.length) errors.push(`${badWeights.length} question(s) have a weight of zero or less.`);

  const catCodes = active.map((c) => c.code.trim().toLowerCase());
  const dupCats = catCodes.filter((c, i) => catCodes.indexOf(c) !== i);
  if (dupCats.length) errors.push(`Duplicate category IDs: ${[...new Set(dupCats)].join(", ")}.`);

  const qCodes = activeQuestions.map((q) => q.question_code.trim().toLowerCase());
  const dupQs = qCodes.filter((c, i) => qCodes.indexOf(c) !== i);
  if (dupQs.length) errors.push(`Duplicate question IDs: ${[...new Set(dupQs)].join(", ")}.`);

  return {
    ok: errors.length === 0,
    weightTotal,
    errors,
    checks: [
      { label: "At least one category", passed: hasCategory, detail: `${active.length} categories` },
      { label: "Category weights total 100%", passed: weightsOk, detail: `${weightTotal}%` },
      {
        label: "Every category has an active question",
        passed: emptyCategories.length === 0,
        detail: `${activeQuestions.length} active questions`,
      },
      { label: "Required question fields complete", passed: blankFields.length === 0 },
      { label: "Question weights are positive", passed: badWeights.length === 0 },
      { label: "Category IDs unique", passed: dupCats.length === 0 },
      { label: "Question IDs unique", passed: dupQs.length === 0 },
    ],
  };
}

export interface TemplatePermissions {
  canCreate: boolean;
  canEditDraft: boolean;
  canCreateVersion: boolean;
  canPublish: boolean;
  canArchive: boolean;
  canDuplicate: boolean;
}

/**
 * Role matrix.
 * - IronIQ admin: everything.
 * - Consultant: author drafts, create versions, publish (no archive/restore).
 * - Customer admin: duplicate published templates into customer-owned drafts and edit those only.
 * - Everyone else: read published templates only.
 */
export function templatePermissions(
  roles: AppRole[],
  template?: Pick<AssessmentTemplate, "owner_organization_id"> | null,
  ownedOrganizationIds: string[] = [],
): TemplatePermissions {
  const none: TemplatePermissions = {
    canCreate: false,
    canEditDraft: false,
    canCreateVersion: false,
    canPublish: false,
    canArchive: false,
    canDuplicate: false,
  };

  if (roles.includes("ironiq_admin")) {
    return {
      canCreate: true,
      canEditDraft: true,
      canCreateVersion: true,
      canPublish: true,
      canArchive: true,
      canDuplicate: true,
    };
  }
  if (roles.includes("consultant")) {
    return {
      canCreate: true,
      canEditDraft: true,
      canCreateVersion: true,
      canPublish: true,
      canArchive: false,
      canDuplicate: true,
    };
  }
  if (roles.includes("customer_admin")) {
    const ownerOrg = template?.owner_organization_id ?? null;
    const owned = ownerOrg !== null && ownedOrganizationIds.includes(ownerOrg);

    return {
      ...none,
      canCreate: true,
      canDuplicate: true,
      canEditDraft: owned,
      canCreateVersion: owned,
      canPublish: owned,
    };
  }
  return none;
}

/** Pure model of "create new version": copy everything, bump the number, reset to draft. */
export function buildVersionCopy(
  source: {
    version: AssessmentTemplateVersion;
    categories: AssessmentCategory[];
    questions: AssessmentQuestion[];
  },
  allVersions: Pick<AssessmentTemplateVersion, "version">[],
) {
  const version = nextVersionNumber(allVersions);
  return {
    version,
    status: "draft" as TemplateStatus,
    categories: source.categories.map((c) => ({
      code: c.code,
      name: c.name,
      description: c.description,
      weight: Number(c.weight),
      sort_order: c.sort_order,
      archived: c.archived,
      questions: source.questions
        .filter((q) => q.category_id === c.id)
        .map((q) => ({
          question_code: q.question_code,
          question_text: q.question_text,
          guidance_text: q.guidance_text,
          weight: Number(q.weight),
          is_critical: q.is_critical,
          required_evidence: q.required_evidence,
          sort_order: q.sort_order,
          is_required: q.is_required,
          allow_not_applicable: q.allow_not_applicable,
          auto_finding: q.auto_finding,
          default_severity: q.default_severity,
          archived: q.archived,
        })),
    })),
  };
}

/** Archived templates must never be selectable when scoping a new assessment. */
export function selectableTemplateVersions(
  templates: AssessmentTemplate[],
  versions: AssessmentTemplateVersion[],
): AssessmentTemplateVersion[] {
  const usable = new Set(
    templates.filter((t) => !t.archived && t.status !== "archived").map((t) => t.id),
  );
  return versions.filter((v) => v.status === "published" && usable.has(v.template_id));
}
