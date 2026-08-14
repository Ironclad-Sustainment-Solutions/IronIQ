import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as fn from "@/lib/production-api.functions";
import type { Database } from "@/integrations/supabase/types";
import type { JobStatus } from "@/lib/workflow";
import { logJobEvent, fetchJobAudit } from "@/lib/production-auth";

export type Job = Database["public"]["Tables"]["jobs"]["Row"];
export type JobInsert = Database["public"]["Tables"]["jobs"]["Insert"];
export type Operation = Database["public"]["Tables"]["operations"]["Row"];
export type AiPlan = Database["public"]["Tables"]["ai_plans"]["Row"];
export type IntakeReview = Database["public"]["Tables"]["intake_reviews"]["Row"];
export type IntakeException = Database["public"]["Tables"]["intake_exceptions"]["Row"];
export type Simulation = Database["public"]["Tables"]["simulations"]["Row"];
export type AutomatedCheck = Database["public"]["Tables"]["automated_checks"]["Row"];
export type ProgrammerApproval = Database["public"]["Tables"]["programmer_approvals"]["Row"];
export type PostRecord = Database["public"]["Tables"]["post_records"]["Row"];
export type SetupSheet = Database["public"]["Tables"]["setup_sheets"]["Row"];
export type ReleasePackage = Database["public"]["Tables"]["release_packages"]["Row"];
export type ProveOutResult = Database["public"]["Tables"]["prove_out_results"]["Row"];
export type MachineProfile = Database["public"]["Tables"]["machine_profiles"]["Row"];
export type ToolingProfile = Database["public"]["Tables"]["tooling_profiles"]["Row"];
export type PostProcessor = Database["public"]["Tables"]["post_processors"]["Row"];
export type MastercamJob = Database["public"]["Tables"]["mastercam_jobs"]["Row"];
export type PlanReview = Database["public"]["Tables"]["plan_reviews"]["Row"];

export function useJobs(organizationId?: string | null) {
  return useQuery({
    queryKey: ["prod-jobs", organizationId ?? "all"],
    queryFn: () => fn.fetchJobs({ data: { id: organizationId ?? undefined } }) as Promise<Job[]>,
  });
}

export function useJob(jobId?: string) {
  return useQuery({
    enabled: Boolean(jobId),
    queryKey: ["prod-job", jobId],
    queryFn: () => fn.fetchJob({ data: { jobId: jobId as string } }) as Promise<Job>,
  });
}

/** Every child record the job console renders, fetched in one round trip. */
export function useJobDetail(jobId?: string) {
  return useQuery({
    enabled: Boolean(jobId),
    queryKey: ["prod-job-detail", jobId],
    queryFn: () =>
      fn.fetchJobDetail({ data: { jobId: jobId as string } }) as Promise<{
        review: IntakeReview | null;
        exceptions: IntakeException[];
        plans: AiPlan[];
        planReviews: PlanReview[];
        operations: Operation[];
        camJob: MastercamJob | null;
        checks: AutomatedCheck[];
        simulations: Simulation[];
        approvals: ProgrammerApproval[];
        posts: PostRecord[];
        sheets: SetupSheet[];
        release: ReleasePackage | null;
        proveOuts: ProveOutResult[];
        files: Database["public"]["Tables"]["job_files"]["Row"][];
      }>,
  });
}

export function useMachineProfiles(organizationId?: string | null) {
  return useQuery({
    queryKey: ["machine-profiles", organizationId ?? "all"],
    queryFn: () =>
      fn.fetchMachineProfiles({ data: { id: organizationId ?? undefined } }) as Promise<
        MachineProfile[]
      >,
  });
}

export function useToolingProfiles() {
  return useQuery({
    queryKey: ["tooling-profiles"],
    queryFn: () => fn.fetchToolingProfiles() as Promise<ToolingProfile[]>,
  });
}

export function usePostProcessors() {
  return useQuery({
    queryKey: ["post-processors"],
    queryFn: () => fn.fetchPostProcessors() as Promise<PostProcessor[]>,
  });
}

export function useProgrammerCapabilities() {
  return useQuery({
    queryKey: ["programmer-capabilities"],
    queryFn: () =>
      fn.fetchProgrammerCapabilities() as Promise<
        Database["public"]["Tables"]["programmer_capabilities"]["Row"][]
      >,
  });
}

export function useJobAudit(jobId?: string) {
  return useQuery({
    enabled: Boolean(jobId),
    queryKey: ["prod-job-audit", jobId],
    queryFn: () => fetchJobAudit({ data: { jobId: jobId as string } }),
  });
}

/** Invalidate everything a job console renders. */
export function useJobRefresh(jobId?: string) {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["prod-job", jobId] });
    qc.invalidateQueries({ queryKey: ["prod-job-detail", jobId] });
    qc.invalidateQueries({ queryKey: ["prod-job-audit", jobId] });
    qc.invalidateQueries({ queryKey: ["prod-jobs"] });
  };
}

export function useAdvanceStatus(jobId?: string) {
  const refresh = useJobRefresh(jobId);
  return useMutation({
    mutationFn: async (input: {
      status: JobStatus;
      action: string;
      detail?: string;
      organizationId: string | null;
      actorId: string | null;
      actorName: string | null;
      patch?: Partial<JobInsert>;
    }) => {
      await fn.advanceStatus({
        data: {
          jobId: jobId!,
          status: input.status,
          action: input.action,
          detail: input.detail ?? null,
          organizationId: input.organizationId,
          actorName: input.actorName,
          patch: input.patch,
        },
      });
      await logJobEvent({
        data: {
          jobId: jobId!,
          organizationId: input.organizationId,
          actorName: input.actorName,
          action: input.action,
          detail: input.detail ?? null,
        },
      });
    },
    onSuccess: refresh,
  });
}
