/**
 * Write-path hooks. Every mutation goes through a server function
 * (src/lib/mutations.functions.ts) which enforces RLS as the signed-in user.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import * as fn from "@/lib/mutations.functions";
import type { CorrectiveAction, Finding, ImprovementProject } from "./domain";

function useInvalidator(keys: string[]) {
  const queryClient = useQueryClient();
  return () =>
    keys.forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));
}

export interface OrganizationInput {
  id?: string;
  name: string;
  industry?: string | null;
  headquarters?: string | null;
  primary_contact_name?: string | null;
  primary_contact_email?: string | null;
  primary_contact_phone?: string | null;
  status?: string;
  archived?: boolean;
}

export function useSaveOrganization() {
  const invalidate = useInvalidator(["organizations"]);
  return useMutation({
    mutationFn: async (input: OrganizationInput) => {
      if (!input.name?.trim())
        throw new Error("Organization name is required.");
      const { id, ...values } = input;
      await fn.saveOrganization({ data: { id, values } });
    },
    onSuccess: () => {
      invalidate();
      toast.success("Organization saved");
    },
    onError: (e) =>
      toast.error(
        e instanceof Error ? e.message : "Could not save organization",
      ),
  });
}

export function useArchiveOrganization() {
  const invalidate = useInvalidator(["organizations", "facilities"]);
  return useMutation({
    mutationFn: async ({ id, archived }: { id: string; archived: boolean }) =>
      fn.archiveOrganization({ data: { id, archived } }),
    onSuccess: () => {
      invalidate();
      toast.success("Organization updated");
    },
    onError: (e) =>
      toast.error(
        e instanceof Error ? e.message : "Could not archive organization",
      ),
  });
}

export interface FacilityInput {
  id?: string;
  organization_id: string;
  name: string;
  address?: string | null;
  primary_products?: string | null;
  primary_processes?: string | null;
  machine_count?: number | null;
  employee_count?: number | null;
  operating_shifts?: number | null;
  primary_contact_name?: string | null;
  primary_contact_email?: string | null;
  status?: string;
  archived?: boolean;
}

export function useSaveFacility() {
  const invalidate = useInvalidator(["facilities"]);
  return useMutation({
    mutationFn: async (input: FacilityInput) => {
      if (!input.name?.trim()) throw new Error("Facility name is required.");
      if (!input.organization_id)
        throw new Error("Select an organization first.");
      const { id, ...values } = input;
      await fn.saveFacility({ data: { id, values } });
    },
    onSuccess: () => {
      invalidate();
      toast.success("Facility saved");
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Could not save facility"),
  });
}

export function useArchiveFacility() {
  const invalidate = useInvalidator(["facilities"]);
  return useMutation({
    mutationFn: async ({ id, archived }: { id: string; archived: boolean }) =>
      fn.archiveFacility({ data: { id, archived } }),
    onSuccess: () => {
      invalidate();
      toast.success("Facility updated");
    },
    onError: (e) =>
      toast.error(
        e instanceof Error ? e.message : "Could not archive facility",
      ),
  });
}

export type FindingUpdate = Partial<
  Pick<
    Finding,
    | "assigned_owner"
    | "target_date"
    | "status"
    | "closure_evidence"
    | "verified_by"
    | "verification_date"
    | "root_cause"
    | "recommended_action"
  >
>;

export function useUpdateFinding() {
  const invalidate = useInvalidator(["findings"]);
  return useMutation({
    mutationFn: async ({
      id,
      values,
      contributeToIntelligence,
    }: {
      id: string;
      values: FindingUpdate;
      /** Consent captured at the moment of closing, per Phase A of the
       * Intelligence Layer plan — only acted on when status is actually
       * transitioning to closed/accepted_risk in this same call. */
      contributeToIntelligence?: boolean;
    }) => {
      if (values.status === "closed" && !values.closure_evidence?.trim()) {
        throw new Error(
          "Closure evidence is required before a finding can be closed.",
        );
      }
      await fn.updateFinding({
        data: { id, values, contributeToIntelligence },
      });
    },
    onSuccess: () => {
      invalidate();
      toast.success("Finding updated");
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Could not update finding"),
  });
}

export function useProjectFindings(projectIds: string[]) {
  const key = [...projectIds].sort().join(",");
  return useQuery({
    enabled: projectIds.length > 0,
    queryKey: ["project-findings", key],
    queryFn: () =>
      fn.fetchProjectFindings({ data: { projectIds } }) as Promise<
        { id: string; project_id: string; finding_id: string }[]
      >,
  });
}

export function useToggleProjectFinding() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      project,
      findingId,
      linked,
    }: {
      project: ImprovementProject;
      findingId: string;
      linked: boolean;
    }) =>
      fn.toggleProjectFinding({
        data: { projectId: project.id, findingId, linked },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-findings"] });
      toast.success("Project links updated");
    },
    onError: (e) =>
      toast.error(
        e instanceof Error ? e.message : "Could not update project links",
      ),
  });
}

// ---------------------------------------------------------------------
// Corrective actions — previously read-only (useCorrectiveActions in
// api.ts existed; nothing wrote to this table). First save/delete path.
// ---------------------------------------------------------------------

export type CorrectiveActionInput = Partial<
  Pick<
    CorrectiveAction,
    | "finding_id"
    | "facility_id"
    | "action_description"
    | "owner"
    | "target_date"
    | "completed_date"
    | "status"
    | "verification_notes"
  >
>;

export function useSaveCorrectiveAction() {
  const invalidate = useInvalidator(["corrective-actions"]);
  return useMutation({
    mutationFn: async ({
      id,
      values,
      contributeToIntelligence,
    }: {
      id?: string;
      values: CorrectiveActionInput;
      contributeToIntelligence?: boolean;
    }) => {
      if (!values.action_description?.trim())
        throw new Error("Describe the corrective action first.");
      if (values.status === "closed" && !values.verification_notes?.trim()) {
        throw new Error(
          "Verification notes are required before closing a corrective action.",
        );
      }
      await fn.saveCorrectiveAction({
        data: { id, values, contributeToIntelligence },
      });
    },
    onSuccess: () => {
      invalidate();
      toast.success("Corrective action saved");
    },
    onError: (e) =>
      toast.error(
        e instanceof Error ? e.message : "Could not save corrective action",
      ),
  });
}

export function useDeleteCorrectiveAction() {
  const invalidate = useInvalidator(["corrective-actions"]);
  return useMutation({
    mutationFn: (id: string) => fn.deleteCorrectiveAction({ data: { id } }),
    onSuccess: () => {
      invalidate();
      toast.success("Corrective action removed");
    },
    onError: (e) =>
      toast.error(
        e instanceof Error ? e.message : "Could not remove corrective action",
      ),
  });
}

// ---------------------------------------------------------------------
// Improvement projects — same story: read-only display existed
// (useImprovementProjects in api.ts), nothing wrote to this table.
// ---------------------------------------------------------------------

export type ImprovementProjectInput = Partial<
  Pick<
    ImprovementProject,
    | "organization_id"
    | "facility_id"
    | "name"
    | "owner"
    | "executive_sponsor"
    | "objective"
    | "baseline_metric"
    | "target_metric"
    | "estimated_financial_impact"
    | "planned_start"
    | "planned_completion"
    | "status"
    | "percent_complete"
    | "risks"
    | "actions"
    | "results"
  >
>;

export function useSaveImprovementProject() {
  const invalidate = useInvalidator(["projects"]);
  return useMutation({
    mutationFn: async ({
      id,
      values,
      contributeToIntelligence,
    }: {
      id?: string;
      values: ImprovementProjectInput;
      contributeToIntelligence?: boolean;
    }) => {
      if (!values.name?.trim()) throw new Error("Name the project first.");
      if (values.status === "complete" && !values.results?.trim()) {
        throw new Error(
          "Record the results before marking a project complete.",
        );
      }
      await fn.saveImprovementProject({
        data: { id, values, contributeToIntelligence },
      });
    },
    onSuccess: () => {
      invalidate();
      toast.success("Project saved");
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Could not save project"),
  });
}

export function useDeleteImprovementProject() {
  const invalidate = useInvalidator(["projects"]);
  return useMutation({
    mutationFn: (id: string) => fn.deleteImprovementProject({ data: { id } }),
    onSuccess: () => {
      invalidate();
      toast.success("Project removed");
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Could not remove project"),
  });
}
