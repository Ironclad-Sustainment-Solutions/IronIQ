import { useMemo } from "react";
import { useAssessments, useResponses, useTemplateContent } from "@/lib/api";
import { computeAssessmentResult, type AssessmentResult } from "@/lib/scoring";
import type { Assessment } from "@/lib/domain";

/**
 * Resolves the most recent finalized (or otherwise latest) assessment for a
 * facility and recomputes its scores from the raw responses.
 */
export function useFacilityResult(facilityId?: string): {
  assessment: Assessment | null;
  assessments: Assessment[];
  result: AssessmentResult | null;
  loading: boolean;
} {
  const assessmentsQuery = useAssessments(facilityId);
  const assessments = useMemo(() => assessmentsQuery.data ?? [], [assessmentsQuery.data]);

  const assessment = useMemo(() => {
    if (assessments.length === 0) return null;
    return assessments.find((a) => a.status === "finalized") ?? assessments[0];
  }, [assessments]);

  const content = useTemplateContent(assessment?.template_version_id);
  const responses = useResponses(assessment?.id);

  const result = useMemo(() => {
    if (!content.data || !responses.data) return null;
    return computeAssessmentResult(content.data.categories, content.data.questions, responses.data);
  }, [content.data, responses.data]);

  return {
    assessment,
    assessments,
    result,
    loading: assessmentsQuery.isLoading || content.isLoading || responses.isLoading,
  };
}

export function useAssessmentResult(assessment: Assessment | null | undefined) {
  const content = useTemplateContent(assessment?.template_version_id);
  const responses = useResponses(assessment?.id);

  const result = useMemo(() => {
    if (!content.data || !responses.data) return null;
    return computeAssessmentResult(content.data.categories, content.data.questions, responses.data);
  }, [content.data, responses.data]);

  return {
    result,
    categories: content.data?.categories ?? [],
    questions: content.data?.questions ?? [],
    responses: responses.data ?? [],
    loading: content.isLoading || responses.isLoading,
  };
}
