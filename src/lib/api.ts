import { useQuery } from "@tanstack/react-query";
import * as fn from "@/lib/api.functions";
import type {
  Assessment,
  AssessmentCategory,
  AssessmentQuestion,
  AssessmentResponse,
  AssessmentTemplate,
  AssessmentTemplateVersion,
  AuditLogEntry,
  CorrectiveAction,
  Facility,
  Finding,
  ImprovementProject,
  Organization,
  ReadinessHistoryPoint,
} from "./domain";

export function useOrganizations() {
  return useQuery({
    queryKey: ["organizations"],
    queryFn: () => fn.fetchOrganizations() as Promise<Organization[]>,
  });
}

export function useFacilities(organizationId?: string) {
  return useQuery({
    queryKey: ["facilities", organizationId ?? "all"],
    queryFn: () => fn.fetchFacilities({ data: { id: organizationId } }) as Promise<Facility[]>,
  });
}

export function useAssessments(facilityId?: string) {
  return useQuery({
    queryKey: ["assessments", facilityId ?? "all"],
    queryFn: () => fn.fetchAssessments({ data: { id: facilityId } }) as Promise<Assessment[]>,
  });
}

export function useAssessment(assessmentId: string) {
  return useQuery({
    queryKey: ["assessment", assessmentId],
    queryFn: () =>
      fn.fetchAssessment({ data: { assessmentId } }) as Promise<Assessment | null>,
  });
}

export function useTemplateContent(templateVersionId?: string) {
  return useQuery({
    enabled: Boolean(templateVersionId),
    queryKey: ["template-content", templateVersionId],
    queryFn: () =>
      fn.fetchTemplateContent({ data: { templateVersionId: templateVersionId as string } }) as Promise<{
        categories: AssessmentCategory[];
        questions: AssessmentQuestion[];
      }>,
  });
}

export function useResponses(assessmentId?: string) {
  return useQuery({
    enabled: Boolean(assessmentId),
    queryKey: ["responses", assessmentId],
    queryFn: () =>
      fn.fetchResponses({ data: { assessmentId: assessmentId as string } }) as Promise<
        AssessmentResponse[]
      >,
  });
}

export function useFindings(facilityId?: string) {
  return useQuery({
    queryKey: ["findings", facilityId ?? "all"],
    queryFn: () => fn.fetchFindings({ data: { id: facilityId } }) as Promise<Finding[]>,
  });
}

export function useCorrectiveActions(facilityId?: string) {
  return useQuery({
    queryKey: ["corrective-actions", facilityId ?? "all"],
    queryFn: () =>
      fn.fetchCorrectiveActions({ data: { id: facilityId } }) as Promise<CorrectiveAction[]>,
  });
}

export function useProjects(facilityId?: string) {
  return useQuery({
    queryKey: ["projects", facilityId ?? "all"],
    queryFn: () => fn.fetchProjects({ data: { id: facilityId } }) as Promise<ImprovementProject[]>,
  });
}

export function useReadinessHistory(facilityId?: string) {
  return useQuery({
    enabled: Boolean(facilityId),
    queryKey: ["readiness-history", facilityId],
    queryFn: () =>
      fn.fetchReadinessHistory({ data: { facilityId: facilityId as string } }) as Promise<
        ReadinessHistoryPoint[]
      >,
  });
}

export function useTemplates() {
  return useQuery({
    queryKey: ["templates"],
    queryFn: () =>
      fn.fetchTemplates() as Promise<{
        templates: AssessmentTemplate[];
        versions: AssessmentTemplateVersion[];
      }>,
  });
}

/** Full authoring library: templates, versions and their category/question content. */
export function useTemplateLibrary() {
  return useQuery({
    queryKey: ["template-library"],
    queryFn: () =>
      fn.fetchTemplateLibrary() as Promise<{
        templates: AssessmentTemplate[];
        versions: AssessmentTemplateVersion[];
        categories: AssessmentCategory[];
        questions: AssessmentQuestion[];
      }>,
  });
}

/** Profiles used to resolve "created by" / "published by" names in the library. */
export function useAuthorProfiles() {
  return useQuery({
    queryKey: ["author-profiles"],
    queryFn: () =>
      fn.fetchAuthorProfiles() as Promise<
        { id: string; full_name: string | null; email: string | null }[]
      >,
  });
}

export function useAuditLog() {
  return useQuery({
    queryKey: ["audit-log"],
    queryFn: () => fn.fetchAuditLog() as Promise<AuditLogEntry[]>,
  });
}

export async function logAudit(entry: {
  organization_id?: string | null;
  facility_id?: string | null;
  actor_name?: string | null;
  action: string;
  entity_type: string;
  entity_id?: string | null;
  details?: Record<string, unknown>;
}) {
  await fn.logAudit({ data: entry });
}
