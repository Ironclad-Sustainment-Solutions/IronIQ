/**
 * Dialog forms for template authoring: template metadata, categories and questions.
 * Every dialog is render-gated by the caller's permissions.
 */

import {
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  EVIDENCE_LABELS,
  SEVERITY_LABELS,
  SEVERITY_ORDER,
  type AssessmentCategory,
  type AssessmentQuestion,
  type AssessmentTemplate,
  type EvidenceType,
  type FindingSeverity,
  type Organization,
} from "@/lib/domain";
import {
  useSaveCategory,
  useSaveQuestion,
  useSaveTemplate,
  type CategoryInput,
  type QuestionInput,
  type TemplateInput,
} from "@/lib/template-mutations";

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  const id = useId();
  const control = isValidElement(children)
    ? cloneElement(children as ReactElement<{ id?: string }>, { id })
    : children;
  return (
    <div className="space-y-1.5">
      <Label className="eyebrow" htmlFor={id}>
        {label}
      </Label>
      {control}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  const id = useId();
  return (
    <div className="flex items-start gap-3 rounded-md border border-border p-3">
      <Checkbox id={id} checked={checked} onCheckedChange={(v) => onChange(v === true)} />
      <div className="space-y-0.5">
        <Label htmlFor={id} className="text-sm font-medium text-foreground">
          {label}
        </Label>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </div>
    </div>
  );
}

const EVIDENCE_OPTIONS = Object.keys(EVIDENCE_LABELS) as EvidenceType[];

export function TemplateDialog({
  template,
  organizations,
  defaultOwnerOrganizationId,
  trigger,
}: {
  template?: AssessmentTemplate;
  organizations: Organization[];
  defaultOwnerOrganizationId?: string | null;
  trigger: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const save = useSaveTemplate();
  const [form, setForm] = useState<TemplateInput>({ name: "", template_code: "" });

  useEffect(() => {
    if (!open) return;
    setForm(
      template
        ? {
            id: template.id,
            name: template.name,
            template_code: template.template_code ?? "",
            description: template.description,
            intended_use: template.intended_use,
            industry: template.industry,
            assessment_type: template.assessment_type,
            owner_organization_id: template.owner_organization_id,
          }
        : {
            name: "",
            template_code: "",
            owner_organization_id: defaultOwnerOrganizationId ?? null,
            initial_version: 1,
          },
    );
  }, [open, template, defaultOwnerOrganizationId]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{template ? "Edit template" : "New assessment template"}</DialogTitle>
          <DialogDescription>
            A new template starts as version 1 in draft. Content is authored before publication.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Template name">
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              maxLength={120}
              placeholder="Manufacturing Readiness Assessment"
            />
          </Field>
          <Field label="Template ID" hint="Stable identifier, e.g. IQ-MRA-001">
            <Input
              value={form.template_code}
              onChange={(e) => setForm((f) => ({ ...f, template_code: e.target.value }))}
              maxLength={40}
              placeholder="IQ-MRA-001"
            />
          </Field>
          <Field label="Assessment type">
            <Input
              value={form.assessment_type ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, assessment_type: e.target.value }))}
              maxLength={80}
              placeholder="Manufacturing Readiness"
            />
          </Field>
          <Field label="Industry">
            <Input
              value={form.industry ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, industry: e.target.value }))}
              maxLength={80}
              placeholder="Discrete manufacturing"
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Description">
              <Textarea
                value={form.description ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                maxLength={600}
                rows={2}
              />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Intended use">
              <Textarea
                value={form.intended_use ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, intended_use: e.target.value }))}
                maxLength={600}
                rows={2}
                placeholder="When and how assessors should apply this template."
              />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Owner" hint="IronIQ-owned templates are available to every client.">
              <Select
                value={form.owner_organization_id ?? "ironiq"}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, owner_organization_id: v === "ironiq" ? null : v }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ironiq">IronIQ (global library)</SelectItem>
                  {organizations.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            disabled={save.isPending}
            onClick={() => save.mutate(form, { onSuccess: () => setOpen(false) })}
          >
            {template ? "Save changes" : "Create draft template"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CategoryDialog({
  versionId,
  category,
  siblings,
  trigger,
}: {
  versionId: string;
  category?: AssessmentCategory;
  siblings: AssessmentCategory[];
  trigger: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const save = useSaveCategory();
  const [form, setForm] = useState<CategoryInput>({
    template_version_id: versionId,
    code: "",
    name: "",
    weight: 0,
  });

  const remaining =
    100 -
    siblings
      .filter((c) => !c.archived && c.id !== category?.id)
      .reduce((acc, c) => acc + Number(c.weight), 0);

  useEffect(() => {
    if (!open) return;
    setForm(
      category
        ? {
            id: category.id,
            template_version_id: versionId,
            code: category.code,
            name: category.name,
            description: category.description,
            weight: Number(category.weight),
          }
        : {
            template_version_id: versionId,
            code: "",
            name: "",
            description: "",
            weight: Math.max(0, Math.round(remaining * 100) / 100),
          },
    );
  }, [open, category, versionId, remaining]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{category ? "Edit category" : "New category"}</DialogTitle>
          <DialogDescription>
            Category weights must total exactly 100% before this version can be published.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Category ID">
            <Input
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
              maxLength={20}
              placeholder="PC"
            />
          </Field>
          <Field label="Weight %" hint={`Unallocated: ${Math.round(remaining * 100) / 100}%`}>
            <Input
              type="number"
              min={0}
              max={100}
              step="0.01"
              value={form.weight}
              onChange={(e) => setForm((f) => ({ ...f, weight: Number(e.target.value) }))}
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Name">
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                maxLength={120}
                placeholder="Process Control & Capability"
              />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Description">
              <Textarea
                value={form.description ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                maxLength={400}
                rows={2}
              />
            </Field>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            disabled={save.isPending}
            onClick={() =>
              save.mutate({ input: form, siblings }, { onSuccess: () => setOpen(false) })
            }
          >
            Save category
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function QuestionDialog({
  categoryId,
  question,
  versionQuestions,
  categoryQuestionCount,
  trigger,
}: {
  categoryId: string;
  question?: AssessmentQuestion;
  versionQuestions: AssessmentQuestion[];
  categoryQuestionCount: number;
  trigger: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const save = useSaveQuestion();
  const [form, setForm] = useState<QuestionInput>({
    category_id: categoryId,
    question_code: "",
    question_text: "",
    weight: 1,
  });

  useEffect(() => {
    if (!open) return;
    setForm(
      question
        ? {
            id: question.id,
            category_id: question.category_id,
            question_code: question.question_code,
            question_text: question.question_text,
            guidance_text: question.guidance_text,
            weight: Number(question.weight),
            is_critical: question.is_critical,
            required_evidence: question.required_evidence,
            is_required: question.is_required,
            allow_not_applicable: question.allow_not_applicable,
            auto_finding: question.auto_finding,
            default_severity: question.default_severity,
          }
        : {
            category_id: categoryId,
            question_code: "",
            question_text: "",
            guidance_text: "",
            weight: 1,
            is_critical: false,
            required_evidence: "document",
            is_required: true,
            allow_not_applicable: true,
            auto_finding: true,
            default_severity: "medium",
          },
    );
  }, [open, question, categoryId]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{question ? "Edit question" : "New question"}</DialogTitle>
          <DialogDescription>
            Questions are scored 0–5. Critical controls scored 0 or 1 cap the facility readiness level.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Question ID" hint="Unique within this template version">
            <Input
              value={form.question_code}
              onChange={(e) => setForm((f) => ({ ...f, question_code: e.target.value }))}
              maxLength={30}
              placeholder="PC-01"
            />
          </Field>
          <Field label="Weight" hint="Relative weight inside the category; must be greater than zero.">
            <Input
              type="number"
              min={0.01}
              step="0.01"
              value={form.weight}
              onChange={(e) => setForm((f) => ({ ...f, weight: Number(e.target.value) }))}
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Question text">
              <Textarea
                value={form.question_text}
                onChange={(e) => setForm((f) => ({ ...f, question_text: e.target.value }))}
                maxLength={600}
                rows={2}
              />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Guidance / scoring anchors">
              <Textarea
                value={form.guidance_text ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, guidance_text: e.target.value }))}
                maxLength={1000}
                rows={3}
              />
            </Field>
          </div>
          <Field label="Required evidence">
            <Select
              value={form.required_evidence ?? "none"}
              onValueChange={(v) => setForm((f) => ({ ...f, required_evidence: v as EvidenceType }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EVIDENCE_OPTIONS.map((e) => (
                  <SelectItem key={e} value={e}>
                    {EVIDENCE_LABELS[e]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Default finding severity">
            <Select
              value={form.default_severity ?? "medium"}
              onValueChange={(v) => setForm((f) => ({ ...f, default_severity: v as FindingSeverity }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SEVERITY_ORDER.map((s) => (
                  <SelectItem key={s} value={s}>
                    {SEVERITY_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Toggle
            label="Critical control"
            hint="A score of 0 or 1 blocks Production Ready."
            checked={Boolean(form.is_critical)}
            onChange={(v) => setForm((f) => ({ ...f, is_critical: v }))}
          />
          <Toggle
            label="Auto-generate finding"
            hint="Create a finding automatically when this question fails."
            checked={Boolean(form.auto_finding)}
            onChange={(v) => setForm((f) => ({ ...f, auto_finding: v }))}
          />
          <Toggle
            label="Required"
            hint="Must be answered before finalization."
            checked={Boolean(form.is_required)}
            onChange={(v) => setForm((f) => ({ ...f, is_required: v }))}
          />
          <Toggle
            label="Allow N/A"
            hint="Assessors may mark this question not applicable."
            checked={Boolean(form.allow_not_applicable)}
            onChange={(v) => setForm((f) => ({ ...f, allow_not_applicable: v }))}
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            disabled={save.isPending}
            onClick={() =>
              save.mutate(
                { input: form, versionQuestions, categoryQuestionCount },
                { onSuccess: () => setOpen(false) },
              )
            }
          >
            Save question
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
