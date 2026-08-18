import { useState } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Pencil, Plus, Trash2 } from "lucide-react";
import {
  PageHeader,
  Panel,
  EmptyState,
} from "@/components/ironiq/layout-primitives";
import { Tag } from "@/components/ironiq/badges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogFooter,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useProspectWorkspace,
  useSaveProspect,
  useDeleteProspect,
  useSaveContact,
  useDeleteContact,
  useSaveNote,
  useDeleteNote,
  useSaveMeeting,
  useDeleteMeeting,
  STAGES,
  type ProspectStage,
  type ProspectContact,
  type ProspectNote,
  type ProspectMeeting,
} from "@/lib/business-development-api";

export const Route = createFileRoute(
  "/_authenticated/business-development/$prospectId",
)({
  head: () => ({ meta: [{ title: "Prospect — IronIQ" }] }),
  component: ProspectDetailPage,
});

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

function ProspectDetailPage() {
  const { prospectId } = Route.useParams();
  const navigate = useNavigate();
  const workspace = useProspectWorkspace(prospectId);
  const deleteProspect = useDeleteProspect();

  if (workspace.isLoading) return <EmptyState message="Loading…" />;
  if (!workspace.data?.prospect)
    return <EmptyState message="Prospect not found." />;

  const { prospect, contacts, notes, meetings } = workspace.data;
  const stageInfo = STAGES.find((s) => s.key === prospect.stage);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link
        to="/business-development"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" aria-hidden /> Business Development
      </Link>

      <PageHeader
        eyebrow={prospect.industry ?? "Prospect"}
        title={prospect.company_name}
        description={`Stage: ${stageInfo?.label ?? prospect.stage}`}
        actions={
          <div className="flex gap-2">
            <EditProspectDialog prospect={prospect} />
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-critical hover:text-critical"
                >
                  <Trash2 className="size-3.5" aria-hidden /> Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    Delete {prospect.company_name}?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    This removes the prospect along with every contact, note,
                    and interaction recorded for it. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-critical text-white hover:bg-critical/90"
                    onClick={() =>
                      deleteProspect.mutate(prospect.id, {
                        onSuccess: () =>
                          navigate({ to: "/business-development" }),
                      })
                    }
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        }
      />

      {/* Notes and Interactions lead, full-width — this is what actually
          matters most day to day (per direct feedback: tracking every
          interaction while a prospect is in the growth stage). Contacts
          is useful reference info, but secondary, so it's pushed below
          rather than competing for the same visual weight. */}
      <Panel title="Notes" actions={<AddNoteDialog prospectId={prospect.id} />}>
        {notes.length === 0 ? (
          <EmptyState message="No notes yet — jot down anything worth remembering." />
        ) : (
          <div className="space-y-3">
            {notes.map((n) => (
              <NoteRow key={n.id} note={n} prospectId={prospect.id} />
            ))}
          </div>
        )}
      </Panel>

      <Panel
        title="Interactions"
        subtitle="Every call, email, and meeting — a running history, not just formal meetings"
        actions={<AddMeetingDialog prospectId={prospect.id} />}
      >
        {meetings.length === 0 ? (
          <EmptyState message="No interactions logged yet." />
        ) : (
          <div className="space-y-3">
            {meetings.map((m) => (
              <MeetingRow key={m.id} meeting={m} prospectId={prospect.id} />
            ))}
          </div>
        )}
      </Panel>

      <Panel
        title="Contacts"
        actions={<AddContactDialog prospectId={prospect.id} />}
      >
        {contacts.length === 0 ? (
          <EmptyState message="No contacts added yet." />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {contacts.map((c) => (
              <ContactRow key={c.id} contact={c} prospectId={prospect.id} />
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

function EditProspectDialog({
  prospect,
}: {
  prospect: {
    id: string;
    company_name: string;
    industry: string | null;
    stage: ProspectStage;
    estimated_value: string | null;
    expected_close_date: string | null;
    lost_reason: string | null;
  };
}) {
  const [open, setOpen] = useState(false);
  const save = useSaveProspect();
  const [form, setForm] = useState({
    company_name: prospect.company_name,
    industry: prospect.industry ?? "",
    stage: prospect.stage,
    estimated_value: prospect.estimated_value ?? "",
    expected_close_date: prospect.expected_close_date ?? "",
    lost_reason: prospect.lost_reason ?? "",
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil className="size-3.5" aria-hidden /> Edit
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit prospect</DialogTitle>
          <DialogDescription>
            Update deal details and pipeline stage.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Company name">
              <Input
                value={form.company_name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, company_name: e.target.value }))
                }
              />
            </Field>
          </div>
          <Field label="Industry">
            <Input
              value={form.industry}
              onChange={(e) =>
                setForm((f) => ({ ...f, industry: e.target.value }))
              }
            />
          </Field>
          <Field label="Stage">
            <Select
              value={form.stage}
              onValueChange={(v) =>
                setForm((f) => ({ ...f, stage: v as ProspectStage }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STAGES.map((s) => (
                  <SelectItem key={s.key} value={s.key}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Estimated value ($)">
            <Input
              type="number"
              value={form.estimated_value}
              onChange={(e) =>
                setForm((f) => ({ ...f, estimated_value: e.target.value }))
              }
            />
          </Field>
          <Field label="Expected close date">
            <Input
              type="date"
              value={form.expected_close_date}
              onChange={(e) =>
                setForm((f) => ({ ...f, expected_close_date: e.target.value }))
              }
            />
          </Field>
          {form.stage === "lost" ? (
            <div className="sm:col-span-2">
              <Field label="Lost reason">
                <Textarea
                  rows={2}
                  value={form.lost_reason}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, lost_reason: e.target.value }))
                  }
                />
              </Field>
            </div>
          ) : null}
        </div>
        <DialogFooter>
          <Button
            disabled={save.isPending || !form.company_name.trim()}
            onClick={() =>
              save.mutate(
                {
                  id: prospect.id,
                  company_name: form.company_name,
                  industry: form.industry || null,
                  stage: form.stage,
                  estimated_value: form.estimated_value
                    ? Number(form.estimated_value)
                    : null,
                  expected_close_date: form.expected_close_date || null,
                  lost_reason: form.lost_reason || null,
                },
                { onSuccess: () => setOpen(false) },
              )
            }
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ContactRow({
  contact,
  prospectId,
}: {
  contact: ProspectContact;
  prospectId: string;
}) {
  const remove = useDeleteContact(prospectId);
  return (
    <div className="rounded-md border border-border p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-foreground">{contact.name}</p>
          {contact.title ? (
            <p className="text-xs text-muted-foreground">{contact.title}</p>
          ) : null}
          {contact.email ? (
            <p className="text-xs text-muted-foreground">{contact.email}</p>
          ) : null}
          {contact.phone ? (
            <p className="text-xs text-muted-foreground">{contact.phone}</p>
          ) : null}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => remove.mutate(contact.id)}
        >
          <Trash2 className="size-3.5" aria-hidden />
        </Button>
      </div>
    </div>
  );
}

function AddContactDialog({ prospectId }: { prospectId: string }) {
  const [open, setOpen] = useState(false);
  const save = useSaveContact();
  const [form, setForm] = useState({
    name: "",
    title: "",
    email: "",
    phone: "",
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <Plus className="size-3.5" aria-hidden /> Add
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add contact</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Field label="Name">
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              autoFocus
            />
          </Field>
          <Field label="Title">
            <Input
              value={form.title}
              onChange={(e) =>
                setForm((f) => ({ ...f, title: e.target.value }))
              }
            />
          </Field>
          <Field label="Email">
            <Input
              value={form.email}
              onChange={(e) =>
                setForm((f) => ({ ...f, email: e.target.value }))
              }
            />
          </Field>
          <Field label="Phone">
            <Input
              value={form.phone}
              onChange={(e) =>
                setForm((f) => ({ ...f, phone: e.target.value }))
              }
            />
          </Field>
        </div>
        <DialogFooter>
          <Button
            disabled={save.isPending || !form.name.trim()}
            onClick={() =>
              save.mutate(
                {
                  prospectId,
                  name: form.name,
                  title: form.title || null,
                  email: form.email || null,
                  phone: form.phone || null,
                },
                {
                  onSuccess: () => {
                    setOpen(false);
                    setForm({ name: "", title: "", email: "", phone: "" });
                  },
                },
              )
            }
          >
            Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NoteRow({
  note,
  prospectId,
}: {
  note: ProspectNote;
  prospectId: string;
}) {
  const remove = useDeleteNote(prospectId);
  const save = useSaveNote();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note.note);

  if (editing) {
    return (
      <div className="rounded-md border border-border p-3">
        <Textarea
          rows={3}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          autoFocus
        />
        <div className="mt-2 flex gap-2">
          <Button
            size="sm"
            disabled={save.isPending || !draft.trim()}
            onClick={() =>
              save.mutate(
                { id: note.id, prospectId, note: draft },
                { onSuccess: () => setEditing(false) },
              )
            }
          >
            Save
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-border p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="whitespace-pre-wrap text-sm text-foreground">
          {note.note}
        </p>
        <div className="flex shrink-0 gap-1">
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
            <Pencil className="size-3.5" aria-hidden />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => remove.mutate(note.id)}
          >
            <Trash2 className="size-3.5" aria-hidden />
          </Button>
        </div>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {new Date(note.created_at).toLocaleString()}
      </p>
    </div>
  );
}

function AddNoteDialog({ prospectId }: { prospectId: string }) {
  const [open, setOpen] = useState(false);
  const save = useSaveNote();
  const [note, setNote] = useState("");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <Plus className="size-3.5" aria-hidden /> Add note
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a note</DialogTitle>
        </DialogHeader>
        <Textarea
          rows={4}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          autoFocus
        />
        <DialogFooter>
          <Button
            disabled={save.isPending || !note.trim()}
            onClick={() =>
              save.mutate(
                { prospectId, note },
                {
                  onSuccess: () => {
                    setOpen(false);
                    setNote("");
                  },
                },
              )
            }
          >
            Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const INTERACTION_TYPE_LABELS: Record<
  ProspectMeeting["interaction_type"],
  string
> = {
  meeting: "Meeting",
  call: "Call",
  email: "Email",
  other: "Other",
};

function MeetingRow({
  meeting,
  prospectId,
}: {
  meeting: ProspectMeeting;
  prospectId: string;
}) {
  const remove = useDeleteMeeting(prospectId);
  return (
    <div className="rounded-md border border-border p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Tag token="steel">
              {INTERACTION_TYPE_LABELS[meeting.interaction_type]}
            </Tag>
            <p className="text-sm font-medium text-foreground">
              {new Date(meeting.meeting_date).toLocaleDateString()}
            </p>
          </div>
          {meeting.attendees ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Attendees: {meeting.attendees}
            </p>
          ) : null}
          {meeting.summary ? (
            <p className="mt-1 text-sm text-foreground">{meeting.summary}</p>
          ) : null}
          {meeting.next_steps ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Next steps: {meeting.next_steps}
            </p>
          ) : null}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => remove.mutate(meeting.id)}
        >
          <Trash2 className="size-3.5" aria-hidden />
        </Button>
      </div>
    </div>
  );
}

function AddMeetingDialog({ prospectId }: { prospectId: string }) {
  const [open, setOpen] = useState(false);
  const save = useSaveMeeting();
  const [form, setForm] = useState({
    meeting_date: new Date().toISOString().slice(0, 10),
    interaction_type: "meeting" as ProspectMeeting["interaction_type"],
    attendees: "",
    summary: "",
    next_steps: "",
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <Plus className="size-3.5" aria-hidden /> Log interaction
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log an interaction</DialogTitle>
          <DialogDescription>
            A call, an email, a meeting — anything worth tracking.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Field label="Type">
            <Select
              value={form.interaction_type}
              onValueChange={(v) =>
                setForm((f) => ({
                  ...f,
                  interaction_type: v as ProspectMeeting["interaction_type"],
                }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(INTERACTION_TYPE_LABELS).map(
                  ([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Date">
            <Input
              type="date"
              value={form.meeting_date}
              onChange={(e) =>
                setForm((f) => ({ ...f, meeting_date: e.target.value }))
              }
            />
          </Field>
          <Field label="Attendees">
            <Input
              value={form.attendees}
              onChange={(e) =>
                setForm((f) => ({ ...f, attendees: e.target.value }))
              }
            />
          </Field>
          <Field label="Summary">
            <Textarea
              rows={3}
              value={form.summary}
              onChange={(e) =>
                setForm((f) => ({ ...f, summary: e.target.value }))
              }
            />
          </Field>
          <Field label="Next steps">
            <Textarea
              rows={2}
              value={form.next_steps}
              onChange={(e) =>
                setForm((f) => ({ ...f, next_steps: e.target.value }))
              }
            />
          </Field>
        </div>
        <DialogFooter>
          <Button
            disabled={save.isPending}
            onClick={() =>
              save.mutate(
                {
                  prospectId,
                  meeting_date: form.meeting_date,
                  interaction_type: form.interaction_type,
                  attendees: form.attendees || null,
                  summary: form.summary || null,
                  next_steps: form.next_steps || null,
                },
                {
                  onSuccess: () => {
                    setOpen(false);
                    setForm({
                      meeting_date: new Date().toISOString().slice(0, 10),
                      interaction_type: "meeting",
                      attendees: "",
                      summary: "",
                      next_steps: "",
                    });
                  },
                },
              )
            }
          >
            Log interaction
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
