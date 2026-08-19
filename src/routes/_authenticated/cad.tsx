import { useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Pencil } from "lucide-react";
import {
  PageHeader,
  Panel,
  EmptyState,
} from "@/components/ironiq/layout-primitives";
import { Tag } from "@/components/ironiq/badges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useApp } from "@/context/app-context";
import {
  useCadJobs,
  useUploadCadJob,
  useDeleteCadJob,
  useCadFields,
  useUpdateCadFieldStatus,
  type CadJobRow,
  type CadFieldRow,
} from "@/lib/cad-api";

export const Route = createFileRoute("/_authenticated/cad")({
  head: () => ({
    meta: [
      { title: "CAD Conversion — IronIQ" },
      {
        name: "description",
        content:
          "Upload scanned or photographed drawings and review AI-extracted dimensional and title-block data.",
      },
      { property: "og:title", content: "CAD Conversion — IronIQ" },
      {
        property: "og:description",
        content: "Drawing-to-data conversion with AI-assisted extraction.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CadConversionPage,
});

const STATUS_TOKEN: Record<
  CadJobRow["status"],
  "steel" | "primary" | "success" | "critical"
> = {
  uploaded: "steel",
  processing: "primary",
  extracted: "success",
  reviewed: "success",
  failed: "critical",
};

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function CadConversionPage() {
  const { organization } = useApp();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  const jobs = useCadJobs(organization?.id);
  const upload = useUploadCadJob(organization?.id);
  const remove = useDeleteCadJob(organization?.id);
  const jobRows = jobs.data ?? [];

  const fields = useCadFields(selectedJobId);
  const updateStatus = useUpdateCadFieldStatus(selectedJobId);

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    for (const file of Array.from(files)) upload.mutate(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  if (!organization) {
    return (
      <div className="mx-auto max-w-6xl space-y-8">
        <PageHeader eyebrow="CAD Conversion" title="CAD Conversion" />
        <EmptyState message="Select an organization first." />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <PageHeader
        eyebrow={organization.name}
        title="CAD Conversion"
        description="Upload a scanned or photographed drawing. AI drafts the title-block fields, dimensions, tolerances and notes it can read — every value is reviewed here before it's treated as real data. This is extraction only: it does not attempt to reconstruct vector geometry from the image."
      />

      <Panel title="1. Upload a drawing">
        <div className="space-y-4">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*"
            onChange={(e) => handleFiles(e.target.files)}
            className="block text-sm text-muted-foreground file:mr-3 file:rounded-sm file:border file:border-border file:bg-muted file:px-3 file:py-1.5 file:text-xs file:font-semibold file:uppercase file:tracking-wide"
          />
          <p className="text-xs text-muted-foreground">
            Image files only for now (scanned/photographed drawings). Vector CAD
            file support (DXF/DWG) is a separate, later pipeline.
          </p>

          {jobRows.length === 0 ? (
            <EmptyState message="No drawings uploaded yet." />
          ) : (
            <div className="divide-y divide-border rounded-md border border-border">
              {jobRows.map((job) => (
                <button
                  key={job.id}
                  type="button"
                  onClick={() => setSelectedJobId(job.id)}
                  className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/30 ${selectedJobId === job.id ? "bg-muted/40" : ""}`}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {job.original_filename}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatBytes(job.byte_size)}
                      {job.status === "failed" && job.failure_reason
                        ? ` · ${job.failure_reason}`
                        : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <Tag token={STATUS_TOKEN[job.status]}>{job.status}</Tag>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        remove.mutate({
                          id: job.id,
                        });
                        if (selectedJobId === job.id) setSelectedJobId(null);
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </Panel>

      <Panel
        title="2. Review extracted fields"
        subtitle={selectedJobId ? undefined : "Select a drawing above"}
      >
        {!selectedJobId ? (
          <EmptyState message="Select an uploaded drawing to review what was extracted from it." />
        ) : (fields.data ?? []).length === 0 ? (
          <EmptyState message="No fields extracted yet — extraction runs automatically right after upload." />
        ) : (
          <div className="space-y-3">
            {(fields.data ?? []).map((f) => (
              <CadFieldReviewRow key={f.id} field={f} jobId={selectedJobId} />
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

function CadFieldReviewRow({
  field: f,
  jobId,
}: {
  field: CadFieldRow;
  jobId: string;
}) {
  const updateStatus = useUpdateCadFieldStatus(jobId);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({
    fieldName: f.field_name,
    fieldValue: f.field_value,
    locationHint: f.location_hint ?? "",
  });

  return (
    <div className="rounded-md border border-border p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {editing ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {f.field_type}
              </p>
              <Input
                autoFocus
                value={draft.fieldName}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, fieldName: e.target.value }))
                }
                placeholder="Field name (e.g. Part Number)"
              />
              <Input
                value={draft.fieldValue}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, fieldValue: e.target.value }))
                }
                placeholder="Value"
              />
              <Input
                value={draft.locationHint}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, locationHint: e.target.value }))
                }
                placeholder="Location on drawing (optional)"
              />
            </div>
          ) : (
            <>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {f.field_type} · {f.field_name}
              </p>
              <p className="mt-1 text-sm text-foreground">{f.field_value}</p>
              {f.location_hint ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Location: {f.location_hint}
                </p>
              ) : null}
            </>
          )}
        </div>
        <Tag
          token={
            f.confidence === "high"
              ? "success"
              : f.confidence === "moderate"
                ? "primary"
                : "steel"
          }
        >
          {f.confidence}
        </Tag>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">status: {f.status}</p>
        <div className="flex gap-2">
          {editing ? (
            <>
              <Button
                size="sm"
                disabled={
                  updateStatus.isPending ||
                  !draft.fieldName.trim() ||
                  !draft.fieldValue.trim()
                }
                onClick={() =>
                  updateStatus.mutate(
                    {
                      id: f.id,
                      status: "edited",
                      editedValue: draft.fieldValue,
                      editedFieldName: draft.fieldName,
                      editedLocationHint: draft.locationHint || undefined,
                    },
                    { onSuccess: () => setEditing(false) },
                  )
                }
              >
                Save correction
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setEditing(false)}
              >
                Cancel
              </Button>
            </>
          ) : (
            <>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setEditing(true)}
              >
                <Pencil className="size-3.5" aria-hidden /> Edit
              </Button>
              {f.status === "suggested" ? (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      updateStatus.mutate({ id: f.id, status: "accepted" })
                    }
                  >
                    Accept
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      updateStatus.mutate({ id: f.id, status: "rejected" })
                    }
                  >
                    Reject
                  </Button>
                </>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
