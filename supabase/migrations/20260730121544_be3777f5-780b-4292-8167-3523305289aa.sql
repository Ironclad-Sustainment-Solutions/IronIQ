CREATE OR REPLACE FUNCTION public.enforce_version_editable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE v_id uuid; st template_status; found_version boolean;
BEGIN
  IF TG_TABLE_NAME = 'assessment_categories' THEN
    v_id := COALESCE(NEW.template_version_id, OLD.template_version_id);
  ELSE
    SELECT c.template_version_id INTO v_id FROM public.assessment_categories c
     WHERE c.id = COALESCE(NEW.category_id, OLD.category_id);
    -- Parent category already removed (cascade delete): nothing left to protect.
    IF v_id IS NULL AND TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
  END IF;

  SELECT status, TRUE INTO st, found_version
    FROM public.assessment_template_versions WHERE id = v_id;

  -- Version row already removed (cascade delete of a draft version): allow.
  IF NOT COALESCE(found_version, FALSE) AND TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  IF st IS DISTINCT FROM 'draft' THEN
    RAISE EXCEPTION 'This template version is % and is read-only. Create a new draft version to make changes.', COALESCE(st::text, 'missing');
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.enforce_version_editable() FROM PUBLIC, anon, authenticated;