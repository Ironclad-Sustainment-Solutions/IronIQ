-- ---------- columns ----------
ALTER TABLE public.assessment_templates
  ADD COLUMN IF NOT EXISTS template_code text,
  ADD COLUMN IF NOT EXISTS intended_use text,
  ADD COLUMN IF NOT EXISTS industry text,
  ADD COLUMN IF NOT EXISTS assessment_type text,
  ADD COLUMN IF NOT EXISTS owner_organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_templates_code ON public.assessment_templates (lower(template_code)) WHERE template_code IS NOT NULL;

ALTER TABLE public.assessment_categories
  ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS uq_categories_version_code ON public.assessment_categories (template_version_id, lower(code));

ALTER TABLE public.assessment_questions
  ADD COLUMN IF NOT EXISTS is_required boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS allow_not_applicable boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS auto_finding boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS default_severity finding_severity NOT NULL DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;

UPDATE public.assessment_questions SET weight = 1 WHERE weight IS NULL OR weight <= 0;
UPDATE public.assessment_questions SET default_severity = 'critical' WHERE is_critical;

ALTER TABLE public.assessment_questions
  DROP CONSTRAINT IF EXISTS chk_question_weight_positive;
ALTER TABLE public.assessment_questions
  ADD CONSTRAINT chk_question_weight_positive CHECK (weight > 0);

-- ---------- authorization helper ----------
CREATE OR REPLACE FUNCTION public.can_edit_template(_template_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL
     AND (
       public.is_platform_staff(auth.uid())
       OR EXISTS (
         SELECT 1
         FROM public.assessment_templates t
         JOIN public.organization_members m ON m.organization_id = t.owner_organization_id
         WHERE t.id = _template_id
           AND m.user_id = auth.uid()
           AND EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role = 'customer_admin')
       )
     );
$$;

REVOKE ALL ON FUNCTION public.can_edit_template(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_edit_template(uuid) TO authenticated;

-- ---------- immutability ----------
CREATE OR REPLACE FUNCTION public.enforce_version_editable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id uuid; st template_status;
BEGIN
  IF TG_TABLE_NAME = 'assessment_categories' THEN
    v_id := COALESCE(NEW.template_version_id, OLD.template_version_id);
  ELSE
    SELECT c.template_version_id INTO v_id FROM public.assessment_categories c
     WHERE c.id = COALESCE(NEW.category_id, OLD.category_id);
  END IF;

  SELECT status INTO st FROM public.assessment_template_versions WHERE id = v_id;
  IF st IS DISTINCT FROM 'draft' THEN
    RAISE EXCEPTION 'This template version is % and is read-only. Create a new draft version to make changes.', COALESCE(st::text, 'missing');
  END IF;
  RETURN COALESCE(NEW, OLD);
END; $$;

REVOKE ALL ON FUNCTION public.enforce_version_editable() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_categories_editable ON public.assessment_categories;
CREATE TRIGGER trg_categories_editable
BEFORE INSERT OR UPDATE OR DELETE ON public.assessment_categories
FOR EACH ROW EXECUTE FUNCTION public.enforce_version_editable();

DROP TRIGGER IF EXISTS trg_questions_editable ON public.assessment_questions;
CREATE TRIGGER trg_questions_editable
BEFORE INSERT OR UPDATE OR DELETE ON public.assessment_questions
FOR EACH ROW EXECUTE FUNCTION public.enforce_version_editable();

CREATE OR REPLACE FUNCTION public.enforce_unique_question_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id uuid; dupes int;
BEGIN
  SELECT template_version_id INTO v_id FROM public.assessment_categories WHERE id = NEW.category_id;
  SELECT count(*) INTO dupes
    FROM public.assessment_questions q
    JOIN public.assessment_categories c ON c.id = q.category_id
   WHERE c.template_version_id = v_id
     AND lower(q.question_code) = lower(NEW.question_code)
     AND q.id <> NEW.id;
  IF dupes > 0 THEN
    RAISE EXCEPTION 'Question ID % already exists in this template version.', NEW.question_code;
  END IF;
  RETURN NEW;
END; $$;

REVOKE ALL ON FUNCTION public.enforce_unique_question_code() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_questions_unique_code ON public.assessment_questions;
CREATE TRIGGER trg_questions_unique_code
BEFORE INSERT OR UPDATE ON public.assessment_questions
FOR EACH ROW EXECUTE FUNCTION public.enforce_unique_question_code();

CREATE OR REPLACE FUNCTION public.enforce_version_lifecycle()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status = 'published' THEN
      RAISE EXCEPTION 'Published template versions cannot be deleted.';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.status = 'published' THEN
    IF NEW.status NOT IN ('published','archived')
       OR NEW.version <> OLD.version
       OR NEW.template_id <> OLD.template_id
       OR NEW.published_at IS DISTINCT FROM OLD.published_at
       OR NEW.published_by IS DISTINCT FROM OLD.published_by
       OR NEW.notes IS DISTINCT FROM OLD.notes THEN
      RAISE EXCEPTION 'Published template versions are immutable. Create a new draft version instead.';
    END IF;
  END IF;
  RETURN NEW;
END; $$;

REVOKE ALL ON FUNCTION public.enforce_version_lifecycle() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_versions_lifecycle ON public.assessment_template_versions;
CREATE TRIGGER trg_versions_lifecycle
BEFORE UPDATE OR DELETE ON public.assessment_template_versions
FOR EACH ROW EXECUTE FUNCTION public.enforce_version_lifecycle();

-- ---------- clone + publish ----------
CREATE OR REPLACE FUNCTION public.clone_template_version(_version_id uuid, _notes text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE src record; new_version int; new_id uuid; cat record; new_cat uuid;
BEGIN
  SELECT * INTO src FROM public.assessment_template_versions WHERE id = _version_id;
  IF src IS NULL THEN RAISE EXCEPTION 'Template version not found.'; END IF;
  IF NOT public.can_edit_template(src.template_id) THEN
    RAISE EXCEPTION 'You are not permitted to create versions of this template.';
  END IF;

  SELECT COALESCE(MAX(version),0) + 1 INTO new_version
    FROM public.assessment_template_versions WHERE template_id = src.template_id;

  INSERT INTO public.assessment_template_versions (template_id, version, status, notes)
  VALUES (src.template_id, new_version, 'draft', COALESCE(_notes, 'Draft copied from v' || src.version))
  RETURNING id INTO new_id;

  FOR cat IN SELECT * FROM public.assessment_categories WHERE template_version_id = _version_id ORDER BY sort_order LOOP
    INSERT INTO public.assessment_categories (template_version_id, code, name, description, weight, sort_order, archived)
    VALUES (new_id, cat.code, cat.name, cat.description, cat.weight, cat.sort_order, cat.archived)
    RETURNING id INTO new_cat;

    INSERT INTO public.assessment_questions
      (category_id, question_code, question_text, guidance_text, weight, is_critical, required_evidence,
       sort_order, is_required, allow_not_applicable, auto_finding, default_severity, archived)
    SELECT new_cat, q.question_code, q.question_text, q.guidance_text, q.weight, q.is_critical, q.required_evidence,
           q.sort_order, q.is_required, q.allow_not_applicable, q.auto_finding, q.default_severity, q.archived
      FROM public.assessment_questions q WHERE q.category_id = cat.id ORDER BY q.sort_order;
  END LOOP;

  RETURN new_id;
END; $$;

REVOKE ALL ON FUNCTION public.clone_template_version(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.clone_template_version(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.publish_template_version(_version_id uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE src record; total numeric; cat_count int; bad int;
BEGIN
  SELECT * INTO src FROM public.assessment_template_versions WHERE id = _version_id;
  IF src IS NULL THEN RAISE EXCEPTION 'Template version not found.'; END IF;
  IF NOT public.can_edit_template(src.template_id) THEN
    RAISE EXCEPTION 'You are not permitted to publish this template.';
  END IF;
  IF src.status <> 'draft' THEN RAISE EXCEPTION 'Only draft versions can be published.'; END IF;

  SELECT COALESCE(SUM(weight),0), count(*) INTO total, cat_count
    FROM public.assessment_categories WHERE template_version_id = _version_id AND archived = false;
  IF cat_count = 0 THEN RAISE EXCEPTION 'Add at least one category before publishing.'; END IF;
  IF round(total,2) <> 100.00 THEN RAISE EXCEPTION 'Category weights must total exactly 100%% (currently %).', round(total,2); END IF;

  SELECT count(*) INTO bad FROM public.assessment_categories c
   WHERE c.template_version_id = _version_id AND c.archived = false
     AND NOT EXISTS (SELECT 1 FROM public.assessment_questions q WHERE q.category_id = c.id AND q.archived = false);
  IF bad > 0 THEN RAISE EXCEPTION 'Every category must contain at least one active question.'; END IF;

  SELECT count(*) INTO bad FROM public.assessment_questions q
    JOIN public.assessment_categories c ON c.id = q.category_id
   WHERE c.template_version_id = _version_id AND q.archived = false
     AND (q.weight <= 0 OR btrim(q.question_text) = '' OR btrim(q.question_code) = '');
  IF bad > 0 THEN RAISE EXCEPTION 'All active questions need an ID, text and a weight greater than zero.'; END IF;

  UPDATE public.assessment_template_versions
     SET status = 'published', published_at = now(), published_by = auth.uid(), updated_at = now()
   WHERE id = _version_id;

  UPDATE public.assessment_templates
     SET status = 'published', updated_at = now(), updated_by = auth.uid()
   WHERE id = src.template_id AND status = 'draft';

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, details)
  VALUES (auth.uid(), 'template_version_published', 'assessment_template_version', _version_id,
          jsonb_build_object('template_id', src.template_id, 'version', src.version));
END; $$;

REVOKE ALL ON FUNCTION public.publish_template_version(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.publish_template_version(uuid) TO authenticated;

-- ---------- RLS: allow customer-owned draft authoring ----------
DROP POLICY IF EXISTS "templates write" ON public.assessment_templates;
CREATE POLICY "templates write" ON public.assessment_templates
  TO authenticated
  USING (public.is_platform_staff(auth.uid()) OR public.can_edit_template(id))
  WITH CHECK (
    public.is_platform_staff(auth.uid())
    OR (
      owner_organization_id IS NOT NULL
      AND public.has_org_access(auth.uid(), owner_organization_id)
      AND public.has_role(auth.uid(), 'customer_admin')
    )
  );

DROP POLICY IF EXISTS "template versions write" ON public.assessment_template_versions;
CREATE POLICY "template versions write" ON public.assessment_template_versions
  TO authenticated
  USING (public.can_edit_template(template_id))
  WITH CHECK (public.can_edit_template(template_id));

DROP POLICY IF EXISTS "categories write" ON public.assessment_categories;
CREATE POLICY "categories write" ON public.assessment_categories
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.assessment_template_versions v WHERE v.id = template_version_id AND public.can_edit_template(v.template_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.assessment_template_versions v WHERE v.id = template_version_id AND public.can_edit_template(v.template_id)));

DROP POLICY IF EXISTS "questions write" ON public.assessment_questions;
CREATE POLICY "questions write" ON public.assessment_questions
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.assessment_categories c
    JOIN public.assessment_template_versions v ON v.id = c.template_version_id
    WHERE c.id = category_id AND public.can_edit_template(v.template_id)))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.assessment_categories c
    JOIN public.assessment_template_versions v ON v.id = c.template_version_id
    WHERE c.id = category_id AND public.can_edit_template(v.template_id)));
