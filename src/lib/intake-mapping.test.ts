import { describe, it, expect } from "vitest";
import {
  isAllowedFieldPath,
  computeGapList,
  ALLOWED_FIELD_PATHS,
} from "@/lib/intake-mapping";

describe("intake field path allowlist", () => {
  it("allows known-good factual fields per system", () => {
    expect(
      isAllowedFieldPath("cap_assessment", "cap_problems.stated_problem"),
    ).toBe(true);
    expect(
      isAllowedFieldPath("field_assessment", "field_gaps.observed_condition"),
    ).toBe(true);
    expect(
      isAllowedFieldPath(
        "template_assessment",
        "assessment_responses.comments",
      ),
    ).toBe(true);
  });

  it("rejects the proprietary-methodology fields — matches the DB constraint exactly", () => {
    expect(
      isAllowedFieldPath("field_assessment", "field_gaps.ironclad_action"),
    ).toBe(false);
    expect(
      isAllowedFieldPath(
        "field_assessment",
        "field_constraints.ironclad_response",
      ),
    ).toBe(false);
    expect(
      isAllowedFieldPath("cap_assessment", "cap_actions.recommended_action"),
    ).toBe(false);
    expect(
      isAllowedFieldPath("template_assessment", "findings.recommended_action"),
    ).toBe(false);
  });

  it("rejects a field path from the wrong system", () => {
    // cap_problems.stated_problem is real, but not for the field system.
    expect(
      isAllowedFieldPath("field_assessment", "cap_problems.stated_problem"),
    ).toBe(false);
  });

  it("rejects an unrecognized/typo'd field path (fails closed)", () => {
    expect(
      isAllowedFieldPath("cap_assessment", "cap_problems.stated_problm"),
    ).toBe(false);
    expect(
      isAllowedFieldPath("cap_assessment", "cap_problems.made_up_field"),
    ).toBe(false);
  });

  it("every allowlisted path excludes the known proprietary columns", () => {
    const banned = [
      "field_gaps.ironclad_action",
      "field_constraints.ironclad_response",
      "cap_actions.recommended_action",
      "findings.recommended_action",
    ];
    for (const system of Object.keys(
      ALLOWED_FIELD_PATHS,
    ) as (keyof typeof ALLOWED_FIELD_PATHS)[]) {
      for (const path of ALLOWED_FIELD_PATHS[system]) {
        expect(banned).not.toContain(path);
      }
    }
  });
});

describe("gap list", () => {
  it("returns fields with no coverage yet", () => {
    const gaps = computeGapList({
      system: "cap_assessment",
      requiredFieldPaths: [
        "cap_problems.stated_problem",
        "cap_problems.desired_outcome",
      ],
      coveredFieldPaths: ["cap_problems.stated_problem"],
    });
    expect(gaps).toEqual(["cap_problems.desired_outcome"]);
  });

  it("returns an empty list when everything is covered", () => {
    const gaps = computeGapList({
      system: "field_assessment",
      requiredFieldPaths: ["field_gaps.observed_condition"],
      coveredFieldPaths: ["field_gaps.observed_condition"],
    });
    expect(gaps).toEqual([]);
  });

  it("returns every required field when nothing is covered", () => {
    const gaps = computeGapList({
      system: "template_assessment",
      requiredFieldPaths: [
        "assessment_responses.comments",
        "assessment_responses.evidence_description",
      ],
      coveredFieldPaths: [],
    });
    expect(gaps).toHaveLength(2);
  });
});
