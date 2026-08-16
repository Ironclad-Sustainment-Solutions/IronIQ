/**
 * Admin user-management data layer. Every read and write goes through
 * server functions (src/lib/admin-users.functions.ts), which enforce a
 * real ironiq_admin check server-side — nothing here should be treated as
 * the actual authorization boundary, only as UI convenience.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import * as fn from "@/lib/admin-users.functions";
import type { AppRole } from "@/lib/domain";

export interface AdminUserOrgMembership {
  membership_id: string;
  organization_id: string;
  organization_name: string;
  role: AppRole;
}

export interface AdminUserRow {
  id: string;
  email: string;
  full_name: string | null;
  job_title: string | null;
  approved: boolean;
  created_at: string;
  roles: AppRole[];
  organizations: AdminUserOrgMembership[];
}

export function useAllUsers() {
  return useQuery({
    queryKey: ["admin-users"],
    queryFn: () => fn.listAllUsers() as Promise<AdminUserRow[]>,
  });
}

export function useApproveUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => fn.approveUser({ data: { id } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success("Account approved");
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Could not approve account"),
  });
}

export function useRejectUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => fn.rejectUser({ data: { id } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success("Account removed");
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Could not remove account"),
  });
}

export function useSetUserRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { userId: string; role: AppRole }) =>
      fn.setUserRole({ data: input }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success("Role updated");
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Could not update role"),
  });
}

export function useAddOrgMembership() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      userId: string;
      organizationId: string;
      role: AppRole;
    }) => fn.addOrgMembership({ data: input }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success("Organization access granted");
    },
    onError: (e) =>
      toast.error(
        e instanceof Error ? e.message : "Could not grant organization access",
      ),
  });
}

export function useRemoveOrgMembership() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (membershipId: string) =>
      fn.removeOrgMembership({ data: { membershipId } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success("Organization access removed");
    },
    onError: (e) =>
      toast.error(
        e instanceof Error ? e.message : "Could not remove organization access",
      ),
  });
}
