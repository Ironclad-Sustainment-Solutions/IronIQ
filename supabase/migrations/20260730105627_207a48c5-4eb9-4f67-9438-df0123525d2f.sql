CREATE OR REPLACE FUNCTION public.enforce_response_editable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE target_id uuid; st assessment_status;
BEGIN
  target_id := COALESCE(NEW.assessment_id, OLD.assessment_id);
  SELECT status INTO st FROM public.assessments WHERE id = target_id;
  IF st = 'finalized' THEN
    RAISE EXCEPTION 'Assessment is finalized and read-only. Reopen it before editing responses.';
  END IF;
  RETURN COALESCE(NEW, OLD);
END; $$;

DROP TRIGGER IF EXISTS trg_responses_editable ON public.assessment_responses;
CREATE TRIGGER trg_responses_editable
BEFORE INSERT OR UPDATE OR DELETE ON public.assessment_responses
FOR EACH ROW EXECUTE FUNCTION public.enforce_response_editable();

CREATE OR REPLACE FUNCTION public.next_finding_code()
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT 'MRA-' || to_char(now(), 'YYYY') || '-' ||
         lpad((COALESCE(MAX(NULLIF(regexp_replace(finding_code, '^.*-', ''), '')::int), 0) + 1)::text, 3, '0')
  FROM public.findings
  WHERE finding_code LIKE 'MRA-' || to_char(now(), 'YYYY') || '-%';
$$;

CREATE UNIQUE INDEX IF NOT EXISTS findings_assessment_question_uniq
  ON public.findings (assessment_id, question_id)
  WHERE assessment_id IS NOT NULL AND question_id IS NOT NULL;

DROP TRIGGER IF EXISTS trg_responses_updated_at ON public.assessment_responses;
CREATE TRIGGER trg_responses_updated_at
BEFORE UPDATE ON public.assessment_responses
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();