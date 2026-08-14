import { describe, it, expect } from "vitest";
import {
  computeAssessmentResult,
  isValidScore,
  applyCriticalGate,
  readinessLevelFor,
  validateCategoryWeights,
  validateQuestionWeight,
  autoFindingSeverity,
  generateFindings,
} from "@/lib/scoring";

const cat = (id: string, weight: number, order = 1) => ({ id, template_version_id: "t", code: id, name: id, description: null, weight, sort_order: order, created_at: "" }) as any;
const q = (id: string, category_id: string, weight = 1, is_critical = false) => ({ id, category_id, question_code: id, question_text: id, guidance_text: null, weight, is_critical, required_evidence: null, sort_order: 1, created_at: "" }) as any;
const r = (question_id: string, score: number | null, extra: any = {}) => ({ id: question_id, assessment_id: "a", question_id, score, not_applicable: false, comments: null, evidence_type: "document", answered_at: null, answered_by: null, created_at: "", updated_at: "", ...extra }) as any;

describe("scoring engine", () => {
  it("validates 0..5 only", () => {
    [0,1,2,3,4,5].forEach(v => expect(isValidScore(v)).toBe(true));
    [-1,6,2.5,"3",null,undefined].forEach(v => expect(isValidScore(v)).toBe(false));
  });

  it("computes weighted category and overall scores", () => {
    const cats = [cat("A", 60), cat("B", 40, 2)];
    const qs = [q("a1","A",2), q("a2","A",1), q("b1","B",1)];
    const res = computeAssessmentResult(cats, qs, [r("a1",4), r("a2",2), r("b1",5)]);
    // A = (4*2 + 2*1) / (5*3) * 100 = 66.7 ; B = 100
    expect(res.categories[0].score).toBe(66.7);
    expect(res.categories[1].score).toBe(100);
    // overall = (66.7*60 + 100*40)/100 = 80.0
    expect(res.overallScore).toBe(80);
    expect(res.rawReadinessLevel).toBe("Production Ready");
  });

  it("excludes unanswered questions from the denominator", () => {
    const cats = [cat("A", 100)];
    const qs = [q("a1","A"), q("a2","A")];
    const res = computeAssessmentResult(cats, qs, [r("a1",5)]);
    expect(res.categories[0].score).toBe(100); // not 50
    expect(res.answered).toBe(1);
    expect(res.applicable).toBe(2);
    expect(res.completionPct).toBe(50);
    expect(res.isComplete).toBe(false);
  });

  it("excludes N/A questions from applicability and completion", () => {
    const cats = [cat("A", 100)];
    const qs = [q("a1","A"), q("a2","A")];
    const res = computeAssessmentResult(cats, qs, [r("a1",5), r("a2",0,{ not_applicable: true })]);
    expect(res.applicable).toBe(1);
    expect(res.isComplete).toBe(true);
    expect(res.overallScore).toBe(100);
  });

  it("drops unscored categories from the overall weight base", () => {
    const cats = [cat("A", 70), cat("B", 30, 2)];
    const res = computeAssessmentResult(cats, [q("a1","A"), q("b1","B")], [r("a1",3)]);
    expect(res.overallScore).toBe(60); // A only
  });

  it("flags critical failures at 0 and 1 only", () => {
    const cats = [cat("A", 100)];
    const qs = [q("c0","A",1,true), q("c1","A",1,true), q("c2","A",1,true), q("n0","A")];
    const res = computeAssessmentResult(cats, qs, [r("c0",0), r("c1",1), r("c2",2), r("n0",0)]);
    expect(res.criticalFailures.map(f => f.id).sort()).toEqual(["c0","c1"]);
    expect(res.hasCriticalFailure).toBe(true);
  });

  it("gates Production Ready and Advanced on critical failure", () => {
    expect(applyCriticalGate("Advanced", true).level).toBe("Conditionally Ready");
    expect(applyCriticalGate("Production Ready", true).level).toBe("Conditionally Ready");
    expect(applyCriticalGate("Needs Improvement", true).level).toBe("Needs Improvement");
    expect(applyCriticalGate("Advanced", false).level).toBe("Advanced");
    const cats = [cat("A", 100)];
    const res = computeAssessmentResult(
      cats,
      [q("a1","A"), q("a2","A"), q("a3","A"), q("a4","A"), q("c","A",1,true)],
      [r("a1",5), r("a2",5), r("a3",5), r("a4",5), r("c",1)],
    );
    expect(res.overallScore).toBe(84);
    expect(res.rawReadinessLevel).not.toBe("Conditionally Ready");
    expect(res.readinessLevel).toBe("Conditionally Ready");
    expect(res.gated).toBe(true);
  });

  it("keeps the confidence score independent of the readiness score", () => {
    const cats = [cat("A", 100)];
    const qs = [q("a1","A"), q("a2","A")];
    const strong = computeAssessmentResult(cats, qs, [r("a1",3,{evidence_type:"system_data"}), r("a2",3,{evidence_type:"system_data"})]);
    const weak = computeAssessmentResult(cats, qs, [r("a1",3,{evidence_type:"none"}), r("a2",3,{evidence_type:"none"})]);
    expect(strong.overallScore).toBe(weak.overallScore);
    expect(strong.confidenceScore).toBe(100);
    expect(weak.confidenceScore).toBe(15);
  });

  it("maps readiness bands", () => {
    expect(readinessLevelFor(95)).toBe("Advanced");
    expect(readinessLevelFor(85)).toBe("Production Ready");
    expect(readinessLevelFor(79.9)).toBe("Conditionally Ready");
    expect(readinessLevelFor(69.2)).toBe("Needs Improvement");
    expect(readinessLevelFor(12)).toBe("High Risk");
  });

  it("returns nulls when nothing is answered", () => {
    const res = computeAssessmentResult([cat("A",100)], [q("a1","A")], []);
    expect(res.overallScore).toBeNull();
    expect(res.confidenceScore).toBeNull();
    expect(res.readinessLevel).toBeNull();
  });
});

describe("category weight validation", () => {
  it("accepts weights that total 100 and rejects others", () => {
    expect(validateCategoryWeights([{ weight: 60 }, { weight: 40 }]).valid).toBe(true);
    const bad = validateCategoryWeights([{ weight: 60 }, { weight: 30 }]);
    expect(bad.valid).toBe(false);
    expect(bad.total).toBe(90);
  });

  it("requires positive question weights", () => {
    expect(validateQuestionWeight(1.5)).toBe(true);
    [0, -2, "1", null].forEach((w) => expect(validateQuestionWeight(w)).toBe(false));
  });
});

describe("auto-generated findings", () => {
  it("raises critical findings for critical questions scored 0-1 only", () => {
    const c = q("c", "A", 1, true);
    expect(autoFindingSeverity({ question: c, response: r("c", 0) })).toBe("critical");
    expect(autoFindingSeverity({ question: c, response: r("c", 1) })).toBe("critical");
    expect(autoFindingSeverity({ question: c, response: r("c", 2) })).toBeNull();
  });

  it("raises high/medium findings for weak non-critical scores", () => {
    const n = q("n", "A");
    expect(autoFindingSeverity({ question: n, response: r("n", 0) })).toBe("high");
    expect(autoFindingSeverity({ question: n, response: r("n", 2) })).toBe("medium");
    expect(autoFindingSeverity({ question: n, response: r("n", 3) })).toBeNull();
  });

  it("ignores unanswered and N/A questions", () => {
    const n = q("n", "A");
    expect(autoFindingSeverity({ question: n })).toBeNull();
    expect(autoFindingSeverity({ question: n, response: r("n", 0, { not_applicable: true }) })).toBeNull();
  });

  it("lists generated findings with category context", () => {
    const cats = [cat("A", 100)];
    const qs = [q("c", "A", 1, true), q("n", "A"), q("ok", "A")];
    const byId: Record<string, any> = { c: r("c", 1), n: r("n", 2), ok: r("ok", 5) };
    const items = qs.map((question) => ({ question, response: byId[question.id] }));

    const out = generateFindings(items as any, () => cats[0].name);
    expect(out.map((f) => f.severity)).toEqual(["critical", "medium"]);
    expect(out[0].categoryName).toBe("A");
  });
});

describe("confidence scoring", () => {
  it("averages evidence strength across answered questions only", () => {
    const cats = [cat("A", 100)];
    const qs = [q("a1", "A"), q("a2", "A"), q("a3", "A")];
    const res = computeAssessmentResult(cats, qs, [
      r("a1", 4, { evidence_type: "document" }), // 60
      r("a2", 4, { evidence_type: "direct_observation" }), // 90
      // a3 unanswered — excluded
    ]);
    expect(res.confidenceScore).toBe(75);
  });

  it("ignores evidence on N/A rows", () => {
    const cats = [cat("A", 100)];
    const qs = [q("a1", "A"), q("a2", "A")];
    const res = computeAssessmentResult(cats, qs, [
      r("a1", 4, { evidence_type: "system_data" }),
      r("a2", 0, { not_applicable: true, evidence_type: "none" }),
    ]);
    expect(res.confidenceScore).toBe(100);
  });
});
