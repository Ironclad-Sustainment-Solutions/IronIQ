import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Pencil } from "lucide-react";
import {
  PageHeader,
  Panel,
  EmptyState,
  DefinitionList,
} from "@/components/ironiq/layout-primitives";
import { Tag } from "@/components/ironiq/badges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { useAuthorProfiles, useTemplateLibrary } from "@/lib/api";
import { useApp } from "@/context/app-context";
import {
  EVIDENCE_LABELS,
  SEVERITY_LABELS,
  type AssessmentCategory,
  type AssessmentQuestion,
  type AssessmentTemplate,
  type AssessmentTemplateVersion,
} from "@/lib/domain";
import {
  isVersionEditable,
  sumCategoryWeights,
  templatePermissions,
  validateForPublish,
} from "@/lib/template-validation";
import {
  useArchiveTemplate,
  useCategoryRowAction,
  useCreateTemplateVersion,
  useDeleteDraftVersion,
  useDuplicateTemplate,
  usePublishTemplateVersion,
  useQuestionRowAction,
} from "@/lib/template-mutations";
import {
  CategoryDialog,
  QuestionDialog,
  TemplateDialog,
} from "@/components/ironiq/template-dialogs";

export const Route = createFileRoute("/_authenticated/templates")({
  head: () => ({
    meta: [
      { title: "Assessment Templates — IronIQ" },
      {
        name: "description",
        content:
          "Author, version and publish weighted manufacturing readiness assessment templates with critical controls and immutable published versions.",
      },
      { property: "og:title", content: "Assessment Templates — IronIQ" },
      {
        property: "og:description",
        content:
          "Template authoring and version control for manufacturing readiness assessments.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TemplatesPage,
});

function statusToken(status: string) {
  if (status === "published") return "success" as const;
  if (status === "draft") return "medium" as const;
  return "steel" as const;
}

function TemplatesPage() {
  const { data, isLoading } = useTemplateLibrary();
  const { data: profiles } = useAuthorProfiles();
  const { roles, organizations } = useApp();

  const templates = useMemo(() => data?.templates ?? [], [data]);
  const versions = useMemo(() => data?.versions ?? [], [data]);
  const categories = useMemo(() => data?.categories ?? [], [data]);
  const questions = useMemo(() => data?.questions ?? [], [data]);

  const ownedOrganizationIds = organizations.map((o) => o.id);
  const basePerms = templatePermissions(roles, null, ownedOrganizationIds);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showArchived, setShowArchived] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    null,
  );
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(
    null,
  );
  const [preview, setPreview] = useState(false);

  const visibleTemplates = templates.filter((t) => {
    if (!showArchived && t.archived) return false;
    if (statusFilter !== "all") {
      const templateVersions = versions.filter((v) => v.template_id === t.id);
      if (!templateVersions.some((v) => v.status === statusFilter))
        return false;
    }
    const needle = search.trim().toLowerCase();
    if (!needle) return true;
    return [t.name, t.template_code, t.industry, t.assessment_type]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(needle));
  });

  const template =
    templates.find((t) => t.id === selectedTemplateId) ??
    visibleTemplates[0] ??
    null;
  const templateVersions = versions
    .filter((v) => v.template_id === template?.id)
    .sort((a, b) => b.version - a.version);
  const version =
    templateVersions.find((v) => v.id === selectedVersionId) ??
    templateVersions[0] ??
    null;

  const perms = templatePermissions(roles, template, ownedOrganizationIds);
  const editable = Boolean(
    version && isVersionEditable(version.status) && perms.canEditDraft,
  );

  const versionCategories = categories
    .filter((c) => c.template_version_id === version?.id)
    .sort((a, b) => a.sort_order - b.sort_order);
  const categoryIds = new Set(versionCategories.map((c) => c.id));
  const versionQuestions = questions
    .filter((q) => categoryIds.has(q.category_id))
    .sort((a, b) => a.sort_order - b.sort_order);

  const validation = validateForPublish(versionCategories, versionQuestions);
  const weightTotal = sumCategoryWeights(versionCategories);

  const authorName = (id: string | null) => {
    if (!id) return "—";
    const p = profiles?.find((x) => x.id === id);
    return p?.full_name ?? p?.email ?? "—";
  };

  const archiveTemplate = useArchiveTemplate();
  const duplicateTemplate = useDuplicateTemplate();
  const createVersion = useCreateTemplateVersion();
  const publishVersion = usePublishTemplateVersion();
  const deleteVersion = useDeleteDraftVersion();

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        eyebrow="Library"
        title="Assessment Templates"
        description="Templates are versioned and immutable once published, so historical assessments always reproduce their original scoring model."
        actions={
          basePerms.canCreate ? (
            <TemplateDialog
              organizations={organizations}
              trigger={<Button>New template</Button>}
            />
          ) : null
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, ID, industry or type"
          className="max-w-xs"
          aria-label="Search templates"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44" aria-label="Filter by status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="draft">Has draft version</SelectItem>
            <SelectItem value="published">Has published version</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant={showArchived ? "secondary" : "ghost"}
          onClick={() => setShowArchived((v) => !v)}
        >
          {showArchived ? "Hide archived" : "Show archived"}
        </Button>
      </div>

      {isLoading ? (
        <EmptyState message="Loading template library…" />
      ) : visibleTemplates.length === 0 ? (
        <EmptyState message="No templates match these filters." />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
          <Panel title="Templates" className="h-fit">
            <ul className="space-y-1">
              {visibleTemplates.map((t) => {
                const tv = versions.filter((v) => v.template_id === t.id);
                const published = tv.filter((v) => v.status === "published");
                const latest = published.sort(
                  (a, b) => b.version - a.version,
                )[0];
                return (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedTemplateId(t.id);
                        setSelectedVersionId(null);
                        setPreview(false);
                      }}
                      className={cn(
                        "w-full rounded-md border px-3 py-2 text-left transition-colors",
                        t.id === template?.id
                          ? "border-primary/60 bg-primary/10"
                          : "border-border hover:bg-muted",
                      )}
                    >
                      <span className="metric block text-[11px] uppercase tracking-widest text-muted-foreground">
                        {t.template_code ?? "—"}
                      </span>
                      <span className="block text-sm font-medium text-foreground">
                        {t.name}
                      </span>
                      <span className="mt-1 flex flex-wrap items-center gap-1.5">
                        {t.archived ? <Tag token="steel">Archived</Tag> : null}
                        {latest ? (
                          <Tag token="success">v{latest.version} live</Tag>
                        ) : null}
                        {tv.some((v) => v.status === "draft") ? (
                          <Tag token="medium">Draft</Tag>
                        ) : null}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </Panel>

          {template && version ? (
            <div className="space-y-6">
              <Panel
                title={template.name}
                subtitle={template.description ?? undefined}
                actions={
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <Button
                      variant="ghost"
                      onClick={() => setPreview((v) => !v)}
                    >
                      {preview ? "Exit preview" : "Preview"}
                    </Button>
                    {perms.canEditDraft && isVersionEditable(version.status) ? (
                      <TemplateDialog
                        template={template}
                        organizations={organizations}
                        trigger={
                          <Button variant="secondary">
                            <Pencil className="size-3.5" aria-hidden /> Edit
                            details
                          </Button>
                        }
                      />
                    ) : null}
                    {perms.canDuplicate ? (
                      <Button
                        variant="secondary"
                        disabled={duplicateTemplate.isPending}
                        onClick={() =>
                          duplicateTemplate.mutate({
                            template,
                            version,
                            categories: versionCategories,
                            questions: versionQuestions,
                            ownerOrganizationId: roles.includes(
                              "customer_admin",
                            )
                              ? (organizations[0]?.id ?? null)
                              : template.owner_organization_id,
                          })
                        }
                      >
                        Duplicate
                      </Button>
                    ) : null}
                    {perms.canArchive ? (
                      <Button
                        variant="ghost"
                        onClick={() =>
                          archiveTemplate.mutate({
                            id: template.id,
                            archived: !template.archived,
                          })
                        }
                      >
                        {template.archived ? "Restore" : "Archive"}
                      </Button>
                    ) : null}
                  </div>
                }
              >
                <DefinitionList
                  items={[
                    {
                      label: "Template ID",
                      value: template.template_code ?? "—",
                    },
                    {
                      label: "Assessment type",
                      value: template.assessment_type ?? "—",
                    },
                    { label: "Industry", value: template.industry ?? "—" },
                    {
                      label: "Owner",
                      value:
                        organizations.find(
                          (o) => o.id === template.owner_organization_id,
                        )?.name ?? "IronIQ (global library)",
                    },
                    {
                      label: "Intended use",
                      value: template.intended_use ?? "—",
                    },
                    {
                      label: "Created by",
                      value: authorName(template.created_by),
                    },
                  ]}
                />
              </Panel>

              <Panel
                title="Versions"
                subtitle="Published versions are locked. Create a new version to make changes."
                actions={
                  <div className="flex flex-wrap items-center gap-2">
                    <Select
                      value={version.id}
                      onValueChange={(v) => {
                        setSelectedVersionId(v);
                        setPreview(false);
                      }}
                    >
                      <SelectTrigger
                        className="w-44"
                        aria-label="Select version"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {templateVersions.map((v) => (
                          <SelectItem key={v.id} value={v.id}>
                            v{v.version} · {v.status}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {perms.canCreateVersion ? (
                      <Button
                        variant="secondary"
                        disabled={createVersion.isPending}
                        onClick={() =>
                          createVersion.mutate(
                            {
                              versionId: version.id,
                              notes: `Copied from v${version.version}`,
                            },
                            { onSuccess: () => setSelectedVersionId(null) },
                          )
                        }
                      >
                        New version from v{version.version}
                      </Button>
                    ) : null}
                  </div>
                }
              >
                <div className="flex flex-wrap items-center gap-3">
                  <Tag token={statusToken(version.status)}>
                    {version.status}
                  </Tag>
                  <span className="metric text-sm text-foreground">
                    Version {version.version}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {version.published_at
                      ? `Published ${version.published_at.slice(0, 10)} by ${authorName(version.published_by)}`
                      : "Not yet published"}
                  </span>
                  {version.notes ? (
                    <span className="text-xs text-muted-foreground">
                      · {version.notes}
                    </span>
                  ) : null}
                  {version.status === "draft" && perms.canEditDraft ? (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="ml-auto">
                          Delete draft
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            Delete draft v{version.version}?
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            This removes the draft and all of its categories and
                            questions. Published versions and existing
                            assessments are unaffected.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() =>
                              deleteVersion.mutate(version, {
                                onSuccess: () => setSelectedVersionId(null),
                              })
                            }
                          >
                            Delete draft
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  ) : null}
                </div>
              </Panel>

              {version.status === "draft" ? (
                <Panel
                  title="Publication checks"
                  subtitle="All checks must pass before this version can be locked and used for assessments."
                  actions={
                    perms.canPublish ? (
                      <Button
                        disabled={!validation.ok || publishVersion.isPending}
                        onClick={() => publishVersion.mutate(version.id)}
                      >
                        Publish v{version.version}
                      </Button>
                    ) : null
                  }
                >
                  <ul className="space-y-2">
                    {validation.checks.map((check) => (
                      <li
                        key={check.label}
                        className="flex items-center gap-3 text-sm"
                      >
                        <Tag token={check.passed ? "success" : "high"}>
                          {check.passed ? "Pass" : "Fail"}
                        </Tag>
                        <span className="text-foreground">{check.label}</span>
                        {check.detail ? (
                          <span className="metric ml-auto text-xs text-muted-foreground">
                            {check.detail}
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </Panel>
              ) : null}

              {preview ? (
                <PreviewPanel
                  template={template}
                  version={version}
                  categories={versionCategories}
                  questions={versionQuestions}
                />
              ) : (
                <ContentEditor
                  version={version}
                  editable={editable}
                  weightTotal={weightTotal}
                  categories={versionCategories}
                  questions={versionQuestions}
                />
              )}
            </div>
          ) : (
            <EmptyState message="Select a template to review its versions." />
          )}
        </div>
      )}
    </div>
  );
}

function ContentEditor({
  version,
  editable,
  weightTotal,
  categories,
  questions,
}: {
  version: AssessmentTemplateVersion;
  editable: boolean;
  weightTotal: number;
  categories: AssessmentCategory[];
  questions: AssessmentQuestion[];
}) {
  const categoryAction = useCategoryRowAction();
  const questionAction = useQuestionRowAction();

  return (
    <Panel
      title="Categories & questions"
      subtitle={
        editable
          ? `Draft content. Category weights currently total ${weightTotal}%.`
          : "This version is published and read-only."
      }
      actions={
        editable ? (
          <CategoryDialog
            versionId={version.id}
            siblings={categories}
            trigger={<Button variant="secondary">Add category</Button>}
          />
        ) : null
      }
    >
      {categories.length === 0 ? (
        <EmptyState message="No categories yet." />
      ) : (
        <div className="space-y-6">
          {categories.map((category, index) => {
            const catQuestions = questions
              .filter((q) => q.category_id === category.id)
              .sort((a, b) => a.sort_order - b.sort_order);
            return (
              <div
                key={category.id}
                className="rounded-md border border-border"
              >
                <div className="flex flex-wrap items-center gap-3 border-b border-border bg-muted/40 px-4 py-3">
                  <span className="metric text-xs uppercase tracking-widest text-muted-foreground">
                    {category.code}
                  </span>
                  <span className="text-sm font-semibold text-foreground">
                    {category.name}
                  </span>
                  <Tag token="primary">{Number(category.weight)}%</Tag>
                  {category.archived ? <Tag token="steel">Archived</Tag> : null}
                  {editable ? (
                    <div className="ml-auto flex flex-wrap items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={index === 0}
                        onClick={() =>
                          categoryAction.mutate({
                            category,
                            action: "up",
                            siblings: categories,
                          })
                        }
                      >
                        ↑
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={index === categories.length - 1}
                        onClick={() =>
                          categoryAction.mutate({
                            category,
                            action: "down",
                            siblings: categories,
                          })
                        }
                      >
                        ↓
                      </Button>
                      <CategoryDialog
                        versionId={version.id}
                        category={category}
                        siblings={categories}
                        trigger={
                          <Button size="sm" variant="ghost">
                            Edit
                          </Button>
                        }
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          categoryAction.mutate({
                            category,
                            action: category.archived ? "restore" : "archive",
                            siblings: categories,
                          })
                        }
                      >
                        {category.archived ? "Restore" : "Archive"}
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="ghost">
                            Delete
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              Delete category {category.code}?
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              Its {catQuestions.length} question(s) are deleted
                              with it. Remaining weights will need to total 100%
                              again before publishing.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() =>
                                categoryAction.mutate({
                                  category,
                                  action: "delete",
                                  siblings: categories,
                                })
                              }
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                      <QuestionDialog
                        categoryId={category.id}
                        versionQuestions={questions}
                        categoryQuestionCount={catQuestions.length}
                        trigger={
                          <Button size="sm" variant="secondary">
                            Add question
                          </Button>
                        }
                      />
                    </div>
                  ) : null}
                </div>
                {catQuestions.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-muted-foreground">
                    No questions yet.
                  </p>
                ) : (
                  <ul className="divide-y divide-border">
                    {catQuestions.map((question, qIndex) => (
                      <li
                        key={question.id}
                        className="flex flex-wrap items-start gap-3 px-4 py-3"
                      >
                        <span className="metric w-16 shrink-0 text-xs text-muted-foreground">
                          {question.question_code}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-foreground">
                            {question.question_text}
                          </p>
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                            <Tag token="steel">
                              Weight {Number(question.weight)}
                            </Tag>
                            {question.is_critical ? (
                              <Tag token="critical">Critical</Tag>
                            ) : null}
                            {question.archived ? (
                              <Tag token="steel">Archived</Tag>
                            ) : null}
                            {question.required_evidence ? (
                              <Tag token="steel">
                                {EVIDENCE_LABELS[question.required_evidence]}
                              </Tag>
                            ) : null}
                            {question.auto_finding ? (
                              <Tag token="low">
                                Auto finding ·{" "}
                                {SEVERITY_LABELS[question.default_severity]}
                              </Tag>
                            ) : null}
                          </div>
                        </div>
                        {editable ? (
                          <div className="flex flex-wrap items-center gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={qIndex === 0}
                              onClick={() =>
                                questionAction.mutate({
                                  question,
                                  action: "up",
                                  siblings: catQuestions,
                                  versionQuestions: questions,
                                })
                              }
                            >
                              ↑
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={qIndex === catQuestions.length - 1}
                              onClick={() =>
                                questionAction.mutate({
                                  question,
                                  action: "down",
                                  siblings: catQuestions,
                                  versionQuestions: questions,
                                })
                              }
                            >
                              ↓
                            </Button>
                            <QuestionDialog
                              categoryId={category.id}
                              question={question}
                              versionQuestions={questions}
                              categoryQuestionCount={catQuestions.length}
                              trigger={
                                <Button size="sm" variant="ghost">
                                  Edit
                                </Button>
                              }
                            />
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                questionAction.mutate({
                                  question,
                                  action: "duplicate",
                                  siblings: catQuestions,
                                  versionQuestions: questions,
                                })
                              }
                            >
                              Duplicate
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                questionAction.mutate({
                                  question,
                                  action: "delete",
                                  siblings: catQuestions,
                                  versionQuestions: questions,
                                })
                              }
                            >
                              Delete
                            </Button>
                          </div>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

function PreviewPanel({
  template,
  version,
  categories,
  questions,
}: {
  template: AssessmentTemplate;
  version: AssessmentTemplateVersion;
  categories: AssessmentCategory[];
  questions: AssessmentQuestion[];
}) {
  const active = categories.filter((c) => !c.archived);
  const activeQuestions = questions.filter((q) => !q.archived);
  return (
    <Panel
      title="Assessor preview"
      subtitle={`${template.template_code ?? template.name} v${version.version} — exactly what an assessor sees, without saving anything.`}
    >
      <div className="space-y-6">
        {active.map((category) => (
          <div key={category.id}>
            <div className="flex items-center gap-3 border-b border-border pb-2">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground">
                {category.code} · {category.name}
              </h3>
              <Tag token="primary">{Number(category.weight)}% of score</Tag>
            </div>
            {category.description ? (
              <p className="mt-2 text-xs text-muted-foreground">
                {category.description}
              </p>
            ) : null}
            <ul className="mt-3 space-y-4">
              {activeQuestions
                .filter((q) => q.category_id === category.id)
                .map((question) => (
                  <li
                    key={question.id}
                    className="rounded-md border border-border p-4"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="metric text-xs text-muted-foreground">
                        {question.question_code}
                      </span>
                      {question.is_critical ? (
                        <Tag token="critical">Critical control</Tag>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm text-foreground">
                      {question.question_text}
                    </p>
                    {question.guidance_text ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {question.guidance_text}
                      </p>
                    ) : null}
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {[0, 1, 2, 3, 4, 5].map((score) => (
                        <span
                          key={score}
                          className="metric inline-flex h-8 w-8 items-center justify-center rounded-sm border border-border text-xs text-muted-foreground"
                        >
                          {score}
                        </span>
                      ))}
                      {question.allow_not_applicable ? (
                        <span className="metric inline-flex h-8 items-center justify-center rounded-sm border border-border px-2 text-xs text-muted-foreground">
                          N/A
                        </span>
                      ) : null}
                    </div>
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </div>
    </Panel>
  );
}
