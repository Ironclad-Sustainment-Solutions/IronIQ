import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import * as fn from "@/lib/business-development.functions";

export type ProspectStage =
  "lead" | "qualifying" | "proposal_sent" | "negotiation" | "won" | "lost";

export const STAGES: { key: ProspectStage; label: string; tagToken: string }[] =
  [
    { key: "lead", label: "Lead", tagToken: "steel" },
    { key: "qualifying", label: "Qualifying", tagToken: "primary" },
    { key: "proposal_sent", label: "Proposal Sent", tagToken: "medium" },
    { key: "negotiation", label: "Negotiation", tagToken: "high" },
    { key: "won", label: "Won", tagToken: "success" },
    { key: "lost", label: "Lost", tagToken: "steel" },
  ];

export interface Prospect {
  id: string;
  company_name: string;
  industry: string | null;
  stage: ProspectStage;
  estimated_value: string | null;
  expected_close_date: string | null;
  lost_reason: string | null;
  assigned_to: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProspectContact {
  id: string;
  prospect_id: string;
  name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  created_at: string;
}

export interface ProspectNote {
  id: string;
  prospect_id: string;
  note: string;
  created_by: string | null;
  created_at: string;
}

export interface ProspectMeeting {
  id: string;
  prospect_id: string;
  meeting_date: string;
  attendees: string | null;
  summary: string | null;
  next_steps: string | null;
  created_by: string | null;
  created_at: string;
}

export interface ProspectWorkspace {
  prospect: Prospect | null;
  contacts: ProspectContact[];
  notes: ProspectNote[];
  meetings: ProspectMeeting[];
}

export function useProspects() {
  return useQuery({
    queryKey: ["prospects"],
    queryFn: () => fn.fetchProspects() as Promise<Prospect[]>,
  });
}

export function useProspectWorkspace(id?: string | null) {
  return useQuery({
    queryKey: ["prospect-workspace", id],
    enabled: Boolean(id),
    queryFn: () =>
      fn.fetchProspectWorkspace({
        data: { id: id as string },
      }) as Promise<ProspectWorkspace>,
  });
}

export interface SaveProspectInput {
  id?: string;
  company_name: string;
  industry?: string | null;
  stage: ProspectStage;
  estimated_value?: number | null;
  expected_close_date?: string | null;
  lost_reason?: string | null;
  assigned_to?: string | null;
}

export function useSaveProspect() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SaveProspectInput) => fn.saveProspect({ data: input }),
    onSuccess: (_data, variables) => {
      void qc.invalidateQueries({ queryKey: ["prospects"] });
      if (variables.id)
        void qc.invalidateQueries({
          queryKey: ["prospect-workspace", variables.id],
        });
      toast.success("Prospect saved");
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Could not save prospect"),
  });
}

export function useDeleteProspect() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => fn.deleteProspect({ data: { id } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["prospects"] });
      toast.success("Prospect deleted");
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Could not delete prospect"),
  });
}

function useWorkspaceMutation<TInput extends { prospectId: string }>(
  fnCall: (input: { data: TInput }) => Promise<unknown>,
  successMessage: string,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: TInput) => fnCall({ data: input }),
    onSuccess: (_data, variables) => {
      void qc.invalidateQueries({
        queryKey: ["prospect-workspace", variables.prospectId],
      });
      toast.success(successMessage);
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Could not save"),
  });
}

export function useSaveContact() {
  return useWorkspaceMutation<{
    id?: string;
    prospectId: string;
    name: string;
    title?: string | null;
    email?: string | null;
    phone?: string | null;
    notes?: string | null;
  }>(fn.saveContact, "Contact saved");
}

export function useDeleteContact(prospectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => fn.deleteContact({ data: { id } }),
    onSuccess: () => {
      void qc.invalidateQueries({
        queryKey: ["prospect-workspace", prospectId],
      });
      toast.success("Contact removed");
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Could not remove contact"),
  });
}

export function useSaveNote() {
  return useWorkspaceMutation<{
    id?: string;
    prospectId: string;
    note: string;
  }>(fn.saveNote, "Note saved");
}

export function useDeleteNote(prospectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => fn.deleteNote({ data: { id } }),
    onSuccess: () => {
      void qc.invalidateQueries({
        queryKey: ["prospect-workspace", prospectId],
      });
      toast.success("Note removed");
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Could not remove note"),
  });
}

export function useSaveMeeting() {
  return useWorkspaceMutation<{
    id?: string;
    prospectId: string;
    meeting_date: string;
    attendees?: string | null;
    summary?: string | null;
    next_steps?: string | null;
  }>(fn.saveMeeting, "Meeting saved");
}

export function useDeleteMeeting(prospectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => fn.deleteMeeting({ data: { id } }),
    onSuccess: () => {
      void qc.invalidateQueries({
        queryKey: ["prospect-workspace", prospectId],
      });
      toast.success("Meeting removed");
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Could not remove meeting"),
  });
}
