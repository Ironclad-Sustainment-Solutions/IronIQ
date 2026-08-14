-- Private schema is not exposed through the Data API, so nothing in it is
-- callable by anon/authenticated over PostgREST.
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

-- Functions that call the helpers must resolve them in the new schema.
ALTER FUNCTION public.has_org_access(uuid, uuid)            SET search_path TO 'private', 'public';
ALTER FUNCTION public.has_facility_access(uuid, uuid)       SET search_path TO 'private', 'public';
ALTER FUNCTION public.can_read_job(uuid)                    SET search_path TO 'private', 'public';
ALTER FUNCTION public.can_edit_template(uuid)               SET search_path TO 'private', 'public';
ALTER FUNCTION public.cap_can_access(uuid)                  SET search_path TO 'private', 'public';
ALTER FUNCTION public.clone_template_version(uuid, text)    SET search_path TO 'private', 'public';
ALTER FUNCTION public.publish_template_version(uuid)        SET search_path TO 'private', 'public';

-- Drop the hard-coded public.* prefixes so the helpers resolve after the move.
CREATE OR REPLACE FUNCTION public.has_org_access(_user_id uuid, _org_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'private', 'public' AS $fn$
  SELECT _user_id IS NOT NULL AND _user_id = auth.uid()
     AND (
       is_platform_staff(_user_id)
       OR EXISTS (SELECT 1 FROM public.organization_members m WHERE m.user_id = _user_id AND m.organization_id = _org_id)
     );
$fn$;

CREATE OR REPLACE FUNCTION public.has_facility_access(_user_id uuid, _facility_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'private', 'public' AS $fn$
  SELECT _user_id IS NOT NULL AND _user_id = auth.uid()
     AND (
       is_platform_staff(_user_id)
       OR EXISTS (
         SELECT 1 FROM public.facilities f
         JOIN public.organization_members m ON m.organization_id = f.organization_id
         WHERE f.id = _facility_id AND m.user_id = _user_id
       )
     );
$fn$;

CREATE OR REPLACE FUNCTION public.can_read_job(_job_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'private', 'public' AS $fn$
  SELECT auth.uid() IS NOT NULL AND (
    is_platform_staff(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.jobs j
      JOIN public.organization_members m ON m.organization_id = j.organization_id
      WHERE j.id = _job_id AND m.user_id = auth.uid()
    )
  );
$fn$;

CREATE OR REPLACE FUNCTION public.can_edit_template(_template_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'private', 'public' AS $fn$
  SELECT auth.uid() IS NOT NULL
     AND (
       is_platform_staff(auth.uid())
       OR EXISTS (
         SELECT 1
         FROM public.assessment_templates t
         JOIN public.organization_members m ON m.organization_id = t.owner_organization_id
         WHERE t.id = _template_id
           AND m.user_id = auth.uid()
           AND EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role = 'customer_admin')
       )
     );
$fn$;

CREATE OR REPLACE FUNCTION public.cap_can_access(_assessment_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'private', 'public' AS $fn$
  SELECT EXISTS (
    SELECT 1 FROM public.cap_assessments a
    WHERE a.id = _assessment_id AND has_org_access(auth.uid(), a.organization_id)
  );
$fn$;

CREATE OR REPLACE FUNCTION public.clone_template_version(_version_id uuid, _notes text DEFAULT NULL::text)
RETURNS uuid LANGUAGE plpgsql SET search_path TO 'private', 'public' AS $fn$
DECLARE src record; new_version int; new_id uuid; cat record; new_cat uuid;
BEGIN
  SELECT * INTO src FROM public.assessment_template_versions WHERE id = _version_id;
  IF src IS NULL THEN RAISE EXCEPTION 'Template version not found.'; END IF;
  IF NOT can_edit_template(src.template_id) THEN
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
END; $fn$;

CREATE OR REPLACE FUNCTION public.publish_template_version(_version_id uuid)
RETURNS void LANGUAGE plpgsql SET search_path TO 'private', 'public' AS $fn$
DECLARE src record; total numeric; cat_count int; bad int;
BEGIN
  SELECT * INTO src FROM public.assessment_template_versions WHERE id = _version_id;
  IF src IS NULL THEN RAISE EXCEPTION 'Template version not found.'; END IF;
  IF NOT can_edit_template(src.template_id) THEN
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
END; $fn$;

-- Now relocate the helpers themselves. Existing RLS policies reference them by
-- OID, so they keep working without any policy rewrite.
ALTER FUNCTION public.has_role(uuid, public.app_role)       SET SCHEMA private;
ALTER FUNCTION public.has_org_access(uuid, uuid)            SET SCHEMA private;
ALTER FUNCTION public.has_facility_access(uuid, uuid)       SET SCHEMA private;
ALTER FUNCTION public.is_platform_staff(uuid)               SET SCHEMA private;
ALTER FUNCTION public.is_internal_user(uuid)                SET SCHEMA private;
ALTER FUNCTION public.can_read_job(uuid)                    SET SCHEMA private;
ALTER FUNCTION public.can_edit_template(uuid)               SET SCHEMA private;
ALTER FUNCTION public.cap_can_access(uuid)                  SET SCHEMA private;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA private FROM PUBLIC, anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA private TO authenticated, service_role;
