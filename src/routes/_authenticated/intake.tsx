import { useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  PageHeader,
  Panel,
  EmptyState,
  PrerequisiteGate,
} from "@/components/ironiq/layout-primitives";
import { Tag } from "@/components/ironiq/badges";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useApp } from "@/context/app-context";
import {
  useIntakeDocuments,
  useUploadIntakeDocument,
  useDeleteIntakeDocument,
  useIntakeSuggestions,
  useUpdateIntakeSuggestionStatus,
  useGenerateIntakeSuggestions,
  type IntakeCategory,
  type IntakeTargetSystem,
  type IntakeDocumentRow,
} from "@/lib/intake-api";

export const Route = createFileRoute("/_authenticated/intake")({
  head: () => ({
    meta: [
      { title: "Bulk Intake — IronIQ" },
      {
        name: "description",
        content:
          "Upload evaluator notes and company documentation to pre-fill assessment fields via AI, then review and accept suggestions before they become part of an assessment.",
      },
      { property: "og:title", content: "Bulk Intake — IronIQ" },
      {
        property: "og:description",
        content: "Mass document upload with AI-assisted pre-fill.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BulkIntakePage,
});

const CATEGORY_LABELS: Record<IntakeCategory, string> = {
  evaluator_note: "Evaluator note",
  company_documentation: "Company documentation",
  other: "Other",
};

const STATUS_TOKEN: Record<
  IntakeDocumentRow["status"],
  "steel" | "primary" | "success" | "critical"
> = {
  uploaded: "steel",
  parsing: "primary",
  parsed: "success",
  failed: "critical",
};

const SYSTEM_LABELS: Record<IntakeTargetSystem, string> = {
  template_assessment: "Assessments",
  cap_assessment: "Capability Assessment",
  field_assessment: "Field Assessment",
};

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function BulkIntakePage() {
  const { organization, organizations, facility, facilities } = useApp();
  const [category, setCategory] = useState<IntakeCategory>(
    "company_documentation",
  );
  const [targetSystem, setTargetSystem] =
    useState<IntakeTargetSystem>("cap_assessment");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const documents = useIntakeDocuments(facility?.id);
  const upload = useUploadIntakeDocument(organization?.id, facility?.id);
  const remove = useDeleteIntakeDocument(facility?.id);
  const generate = useGenerateIntakeSuggestions(organization?.id, facility?.id);
  const suggestions = useIntakeSuggestions(facility?.id, targetSystem);
  const updateStatus = useUpdateIntakeSuggestionStatus(facility?.id);

  // Which suggestion (if any) has its inline edit form open, and the
  // in-progress edited text for it. Reviewers can already Accept/Reject
  // as-is, but a suggestion that's *almost* right previously had no way
  // to be corrected before saving -- the backend already supported
  // status: "edited" with an editedValue, this just wires the UI to it.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editedText, setEditedText] = useState("");

  const docRows = documents.data ?? [];
  const parsedCount = docRows.filter((d) => d.status === "parsed").length;

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    for (const file of Array.from(files)) {
      upload.mutate({ file, category });
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  if (!facility) {
    return (
      <div className="mx-auto max-w-6xl space-y-8">
        <PageHeader
          eyebrow={organization?.name ?? "Portfolio"}
          title="Bulk Intake"
          description="Upload evaluator notes and company documentation. AI drafts suggested field values from what's actually in them — every suggestion is reviewed here before it's used, and nothing writes to an assessment until you accept it."
        />
        <PrerequisiteGate
          requirements={[
            {
              label:
                "You need at least one organization before using Bulk Intake.",
              met: organizations.length > 0,
              ctaLabel: "Create an organization",
              ctaTo: "/organizations",
            },
            {
              label: `${organization?.name ?? "This organization"} has no facilities yet — Bulk Intake is scoped per facility.`,
              met: facilities.length > 0,
              ctaLabel: "Add a facility",
              ctaTo: "/facilities",
            },
          ]}
        >
          <EmptyState message="No facility selected." />
        </PrerequisiteGate>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <PageHeader
        eyebrow={facility.name}
        title="Bulk Intake"
        description="Upload evaluator notes and company documentation. AI drafts suggested field values from what's actually in them — every suggestion is reviewed here before it's used, and nothing writes to an assessment until you accept it."
      />

      <Panel
        title="1. Upload"
        subtitle="Evaluator/company notes, current-process documentation, or anything else relevant to this visit."
        actions={
          <Select
            value={category}
            onValueChange={(v) => setCategory(v as IntakeCategory)}
          >
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      >
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={(e) => handleFiles(e.target.files)}
              className="block text-sm text-muted-foreground file:mr-3 file:rounded-sm file:border file:border-border file:bg-muted file:px-3 file:py-1.5 file:text-xs file:font-semibold file:uppercase file:tracking-wide"
            />
            <span className="text-xs text-muted-foreground">
              Category applies to files selected next — pick it before choosing
              files.
            </span>
          </div>

          {docRows.length === 0 ? (
            <EmptyState message="No documents uploaded yet for this facility." />
          ) : (
            <div className="divide-y divide-border rounded-md border border-border">
              {docRows.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {doc.original_filename}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {CATEGORY_LABELS[doc.category]} ·{" "}
                      {formatBytes(doc.byte_size)}
                      {doc.status === "failed" && doc.failure_reason
                        ? ` · ${doc.failure_reason}`
                        : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <Tag token={STATUS_TOKEN[doc.status]}>{doc.status}</Tag>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        remove.mutate({
                          id: doc.id,
                        })
                      }
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Panel>

      <Panel
        title="2. Generate suggestions"
        subtitle="Runs AI summarization over every parsed document, then proposes values for the chosen assessment system. Nothing is written to an assessment yet — review below first."
        actions={
          <div className="flex items-center gap-2">
            <Select
              value={targetSystem}
              onValueChange={(v) => setTargetSystem(v as IntakeTargetSystem)}
            >
              <SelectTrigger className="w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(SYSTEM_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={() =>
                generate.mutate({ targetSystem, documents: docRows })
              }
              disabled={generate.isPending || parsedCount === 0}
              title={
                parsedCount === 0
                  ? "Upload and wait for at least one document to finish parsing first."
                  : undefined
              }
            >
              {generate.isPending ? "Generating…" : "Generate"}
            </Button>
          </div>
        }
      >
        <p className="text-xs text-muted-foreground">
          {parsedCount === 0 ? (
            <span className="text-primary">
              No parsed documents yet — upload at least one above before
              generating suggestions.
            </span>
          ) : (
            <>
              {parsedCount} of {docRows.length} uploaded document(s) are parsed
              and available to draw from.
            </>
          )}
        </p>
      </Panel>

      <Panel
        title="3. Review & accept"
        subtitle={`For ${SYSTEM_LABELS[targetSystem]}`}
      >
        {(suggestions.data ?? []).length === 0 ? (
          <EmptyState message="No suggestions yet for this system — generate some above." />
        ) : (
          <div className="space-y-3">
            {(suggestions.data ?? []).map((s) => (
              <div key={s.id} className="rounded-md border border-border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {s.target_field_path}
                    </p>
                    {editingId === s.id ? (
                      <Textarea
                        autoFocus
                        value={editedText}
                        onChange={(e) => setEditedText(e.target.value)}
                        className="mt-1"
                        rows={3}
                      />
                    ) : (
                      <p className="mt-1 text-sm text-foreground">
                        {s.suggested_value}
                      </p>
                    )}
                  </div>
                  <Tag
                    token={
                      s.confidence === "high"
                        ? "success"
                        : s.confidence === "moderate"
                          ? "primary"
                          : "steel"
                    }
                  >
                    {s.confidence}
                  </Tag>
                </div>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <p className="text-xs text-muted-foreground">
                    {s.source_document_names?.length
                      ? `Sourced from ${s.source_document_names.join(", ")}`
                      : `Sourced from ${s.source_document_ids.length} document(s)`}{" "}
                    · status: {s.status}
                  </p>
                  {s.status === "suggested" ? (
                    editingId === s.id ? (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!editedText.trim()}
                          onClick={() => {
                            updateStatus.mutate({
                              id: s.id,
                              status: "edited",
                              editedValue: editedText,
                            });
                            setEditingId(null);
                          }}
                        >
                          Save edit
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditingId(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            updateStatus.mutate({ id: s.id, status: "accepted" })
                          }
                        >
                          Accept
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setEditingId(s.id);
                            setEditedText(s.suggested_value);
                          }}
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            updateStatus.mutate({ id: s.id, status: "rejected" })
                          }
                        >
                          Reject
                        </Button>
                      </div>
                    )
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
