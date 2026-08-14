import { describe, expect, it } from "vitest";
import type {
  AssessmentCategory,
  AssessmentQuestion,
  AssessmentTemplate,
  AssessmentTemplateVersion,
} from "./domain";
import {
  buildVersionCopy,
  isVersionEditable,
  nextVersionNumber,
  selectableTemplateVersions,
  sumCategoryWeights,
  templatePermissions,
  validateCategoryInput,
  validateForPublish,
  validateQuestionInput,
} from "./template-validation";

function cat(over: Partial<AssessmentCategory> = {}): AssessmentCategory {
  return {
    id: over.id ?? "cat-1",
    template_version_id: "v1",
    code: "CAT",
    name: "Category",
    description: null,
    weight: 100,
    sort_order: 0,
    archived: false,
    ...over,
  };
}

function q(over: Partial<AssessmentQuestion> = {}): AssessmentQuestion {
  return {
    id: over.id ?? "q-1",
    category_id: "cat-1",
    question_code: "Q1",
    question_text: "Is the process documented?",
    guidance_text: null,
    weight: 1,
    is_critical: false,
    required_evidence: "document",
    sort_order: 0,
    is_required: true,
    allow_not_applicable: true,
    auto_finding: true,
    default_severity: "medium",
    archived: false,
    ...over,
  };
}

function template(over: Partial<AssessmentTemplate> = {}): AssessmentTemplate {
  return {
    id: "t1",
    name: "MRA",
    template_code: "IQ-MRA-001",
    description: null,
    intended_use: null,
    industry: null,
    assessment_type: null,
    owner_organization_id: null,
    status: "published",
    archived: false,
    created_by: null,
    updated_by: null,
    created_at: "2026-01-01",
    updated_at: "2026-01-01",
    ...over,
  };
}

function version(over: Partial<AssessmentTemplateVersion> = {}): AssessmentTemplateVersion {
  return {
    id: "v1",
    template_id: "t1",
    version: 1,
    status: "published",
    published_at: "2026-01-01",
    published_by: null,
    notes: null,
    created_at: "2026-01-01",
    updated_at: "2026-01-01",
    ...over,
  };
}

describe("category weights", () => {
  it("blocks publishing unless active category weights total exactly 100%", () => {
    const cats = [cat({ id: "a", code: "A", weight: 60 }), cat({ id: "b", code: "B", weight: 30 })];
    const questions = [q({ id: "q1", category_id: "a" }), q({ id: "q2", question_code: "Q2", category_id: "b" })];
    const result = validateForPublish(cats, questions);
    expect(result.weightTotal).toBe(90);
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toMatch(/total exactly 100%/);
  });

  it("passes when weights total 100% and every category has a question", () => {
    const cats = [cat({ id: "a", code: "A", weight: 60 }), cat({ id: "b", code: "B", weight: 40 })];
    const questions = [q({ id: "q1", category_id: "a" }), q({ id: "q2", question_code: "Q2", category_id: "b" })];
    const result = validateForPublish(cats, questions);
    expect(result.ok).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("excludes archived categories from the weight total", () => {
    expect(
      sumCategoryWeights([cat({ weight: 100 }), cat({ id: "z", weight: 25, archived: true })]),
    ).toBe(100);
  });

  it("requires at least one category and one active question per category", () => {
    expect(validateForPublish([], []).errors.join(" ")).toMatch(/at least one category/i);
    const empty = validateForPublish([cat({ id: "a", code: "A", weight: 100 })], []);
    expect(empty.errors.join(" ")).toMatch(/at least one active question/i);
  });
});

describe("immutability of published versions", () => {
  it("only allows editing draft versions", () => {
    expect(isVersionEditable("draft")).toBe(true);
    expect(isVersionEditable("published")).toBe(false);
    expect(isVersionEditable("archived")).toBe(false);
  });
});

describe("create new version", () => {
  it("copies all categories and questions into an incremented draft", () => {
    const cats = [cat({ id: "a", code: "A", weight: 70 }), cat({ id: "b", code: "B", weight: 30 })];
    const questions = [
      q({ id: "q1", category_id: "a", is_critical: true, default_severity: "critical", weight: 2 }),
      q({ id: "q2", question_code: "Q2", category_id: "a" }),
      q({ id: "q3", question_code: "Q3", category_id: "b" }),
    ];
    const copy = buildVersionCopy({ version: version(), categories: cats, questions }, [
      version({ version: 1 }),
      version({ id: "v2", version: 2, status: "draft" }),
    ]);

    expect(copy.version).toBe(3);
    expect(copy.status).toBe("draft");
    expect(copy.categories).toHaveLength(2);
    expect(copy.categories.flatMap((c) => c.questions)).toHaveLength(3);
    expect(copy.categories[0].questions[0]).toMatchObject({
      question_code: "Q1",
      is_critical: true,
      default_severity: "critical",
      weight: 2,
    });
    expect(sumCategoryWeights(copy.categories.map((c) => ({ weight: c.weight, archived: c.archived })))).toBe(100);
  });

  it("increments from the highest existing version", () => {
    expect(nextVersionNumber([{ version: 1 }, { version: 4 }, { version: 2 }])).toBe(5);
    expect(nextVersionNumber([])).toBe(1);
  });

  it("leaves the source version untouched", () => {
    const source = version();
    const cats = [cat({ id: "a", code: "A", weight: 100 })];
    buildVersionCopy({ version: source, categories: cats, questions: [q({ category_id: "a" })] }, [source]);
    expect(source.status).toBe("published");
    expect(source.version).toBe(1);
    expect(cats[0].weight).toBe(100);
  });
});

describe("assessments retain their template version", () => {
  it("keeps the original version id when a newer version is published", () => {
    const v1 = version({ id: "v1", version: 1, status: "published" });
    const v2 = version({ id: "v2", version: 2, status: "published" });
    const assessment = { id: "a1", template_version_id: v1.id };
    const versions = [v1, v2];
    const resolved = versions.find((v) => v.id === assessment.template_version_id);
    expect(resolved?.version).toBe(1);
    expect(assessment.template_version_id).toBe("v1");
  });
});

describe("id and weight validation", () => {
  it("rejects duplicate question IDs within a version", () => {
    const errors = validateQuestionInput(
      { question_code: "q1", question_text: "Text", weight: 1 },
      [{ id: "existing", question_code: "Q1" }],
    );
    expect(errors.join(" ")).toMatch(/already used/i);
  });

  it("allows a question to keep its own ID while editing", () => {
    expect(
      validateQuestionInput({ question_code: "Q1", question_text: "Text", weight: 1 }, [
        { id: "same", question_code: "Q1" },
      ], "same"),
    ).toHaveLength(0);
  });

  it("rejects duplicate category IDs within a version", () => {
    const errors = validateCategoryInput({ code: "PC", name: "Process Control", weight: 10 }, [
      { id: "other", code: "pc" },
    ]);
    expect(errors.join(" ")).toMatch(/already used/i);
  });

  it("rejects zero or negative question weights", () => {
    expect(validateQuestionInput({ question_code: "Q9", question_text: "T", weight: 0 }, []).join(" ")).toMatch(
      /greater than zero/,
    );
    expect(validateQuestionInput({ question_code: "Q9", question_text: "T", weight: -3 }, []).join(" ")).toMatch(
      /greater than zero/,
    );
    const publishCheck = validateForPublish(
      [cat({ id: "a", code: "A", weight: 100 })],
      [q({ category_id: "a", weight: 0 })],
    );
    expect(publishCheck.ok).toBe(false);
  });

  it("rejects blank required fields", () => {
    expect(validateCategoryInput({ code: " ", name: "", weight: 5 }, [])).toHaveLength(2);
  });
});

describe("permissions", () => {
  it("lets IronIQ admins and consultants publish, but not read-only roles", () => {
    expect(templatePermissions(["ironiq_admin"]).canPublish).toBe(true);
    expect(templatePermissions(["consultant"]).canPublish).toBe(true);
    expect(templatePermissions(["facility_manager"]).canPublish).toBe(false);
    expect(templatePermissions(["assessor"]).canPublish).toBe(false);
    expect(templatePermissions(["executive"]).canPublish).toBe(false);
    expect(templatePermissions(["executive"]).canEditDraft).toBe(false);
  });

  it("only IronIQ admins can archive or restore", () => {
    expect(templatePermissions(["ironiq_admin"]).canArchive).toBe(true);
    expect(templatePermissions(["consultant"]).canArchive).toBe(false);
    expect(templatePermissions(["customer_admin"]).canArchive).toBe(false);
  });

  it("customer admins can only edit templates their own organization owns", () => {
    const ironiqOwned = template({ owner_organization_id: null });
    const customerOwned = template({ id: "t2", owner_organization_id: "org-1", status: "draft" });
    expect(templatePermissions(["customer_admin"], ironiqOwned, ["org-1"]).canEditDraft).toBe(false);
    expect(templatePermissions(["customer_admin"], ironiqOwned, ["org-1"]).canPublish).toBe(false);
    expect(templatePermissions(["customer_admin"], customerOwned, ["org-1"]).canEditDraft).toBe(true);
    expect(templatePermissions(["customer_admin"], customerOwned, ["org-2"]).canEditDraft).toBe(false);
    expect(templatePermissions(["customer_admin"], ironiqOwned, ["org-1"]).canDuplicate).toBe(true);
  });
});

describe("archived templates", () => {
  it("cannot be selected for new assessments", () => {
    const live = template({ id: "t1" });
    const archived = template({ id: "t2", archived: true, status: "archived" });
    const versions = [
      version({ id: "v1", template_id: "t1", status: "published" }),
      version({ id: "v2", template_id: "t2", status: "published" }),
      version({ id: "v3", template_id: "t1", status: "draft" }),
    ];
    const selectable = selectableTemplateVersions([live, archived], versions);
    expect(selectable.map((v) => v.id)).toEqual(["v1"]);
  });
});
