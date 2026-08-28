import { useState, type ReactNode } from "react";
import { EmptyState, Panel } from "@/components/ironiq/layout-primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  useDeleteMachineProgramPart,
  useMachineProgramParts,
  useSaveMachineProgramPart,
} from "@/lib/shop-floor-api";
import { formatDate } from "@/lib/utils";

function emptyDraft() {
  return {
    programName: "",
    partId: "",
    validFrom: new Date().toISOString().slice(0, 16),
    validTo: "",
  };
}

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 16);
}

export function ProgramPartMapEditor({
  organizationId,
  plantId,
}: {
  organizationId: string;
  plantId: string;
}) {
  const mappings = useMachineProgramParts(organizationId, plantId).data ?? [];
  const save = useSaveMachineProgramPart(organizationId, plantId);
  const remove = useDeleteMachineProgramPart(organizationId, plantId);
  const [draft, setDraft] = useState(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);

  const ready = draft.programName.trim() && draft.partId.trim();

  return (
    <Panel
      title="Program → part"
      subtitle="The control sends an O-number. IronIQ maps it to a part. Add a second window only if the same program is later used on a different part."
    >
      <form
        className="mb-6 grid gap-3 sm:grid-cols-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!ready) return;
          save.mutate(
            {
              id: editingId ?? undefined,
              programName: draft.programName,
              partId: draft.partId,
              validFrom: new Date(draft.validFrom).toISOString(),
              validTo: draft.validTo
                ? new Date(draft.validTo).toISOString()
                : null,
            },
            {
              onSuccess: () => {
                setDraft(emptyDraft());
                setEditingId(null);
              },
            },
          );
        }}
      >
        <Field label="Program">
          <Input
            value={draft.programName}
            onChange={(e) =>
              setDraft((d) => ({ ...d, programName: e.target.value }))
            }
            placeholder="O5123"
            required
          />
        </Field>
        <Field label="Part">
          <Input
            value={draft.partId}
            onChange={(e) =>
              setDraft((d) => ({ ...d, partId: e.target.value }))
            }
            placeholder="38742"
            required
          />
        </Field>
        <Field label="Valid from">
          <Input
            type="datetime-local"
            value={draft.validFrom}
            onChange={(e) =>
              setDraft((d) => ({ ...d, validFrom: e.target.value }))
            }
            required
          />
        </Field>
        <Field label="Valid to (optional)">
          <Input
            type="datetime-local"
            value={draft.validTo}
            onChange={(e) =>
              setDraft((d) => ({ ...d, validTo: e.target.value }))
            }
          />
        </Field>
        <div className="flex gap-2 sm:col-span-4">
          <Button type="submit" disabled={!ready || save.isPending}>
            {editingId ? "Save mapping" : "Add mapping"}
          </Button>
          {editingId ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setDraft(emptyDraft());
                setEditingId(null);
              }}
            >
              Cancel
            </Button>
          ) : null}
        </div>
      </form>

      {mappings.length === 0 ? (
        <EmptyState message="No program map yet. Unmapped programs still show on the floor; part hours wait until this is filled." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                {["Program", "Part", "From", "To", ""].map((h) => (
                  <th key={h} className="eyebrow py-2 pr-4">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {mappings.map((row) => (
                <tr key={row.id} className="border-b border-border/60">
                  <td className="py-2.5 pr-4 font-medium">
                    {row.program_name}
                  </td>
                  <td className="py-2.5 pr-4">{row.part_id}</td>
                  <td className="py-2.5 pr-4">{formatDate(row.valid_from)}</td>
                  <td className="py-2.5 pr-4">
                    {row.valid_to ? formatDate(row.valid_to) : "open"}
                  </td>
                  <td className="py-2.5 pr-0 text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setDraft({
                          programName: row.program_name,
                          partId: row.part_id,
                          validFrom: toLocalInput(row.valid_from),
                          validTo: toLocalInput(row.valid_to),
                        });
                        setEditingId(row.id);
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        if (
                          confirm(
                            `Remove ${row.program_name} → ${row.part_id}?`,
                          )
                        ) {
                          remove.mutate(row.id);
                        }
                      }}
                    >
                      Remove
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="eyebrow">{label}</Label>
      {children}
    </div>
  );
}
