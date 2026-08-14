-- 1. Programmer auto-assignment is only ever needed inside the jobs trigger,
--    which runs as the definer owner. No client role should be able to call it.
REVOKE ALL ON FUNCTION public.select_programmer_for_job(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complexity_rank(public.complexity_level) FROM PUBLIC, anon;

-- 2. The remaining SECURITY DEFINER functions are RLS helpers: Postgres evaluates
--    policy expressions as the querying role, so `authenticated` must retain
--    EXECUTE or every policy that references them fails closed. Remove any
--    broader PUBLIC/anon grant and re-assert the minimal grant explicitly.
DO $$
DECLARE fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.has_role(uuid, public.app_role)',
    'public.has_org_access(uuid, uuid)',
    'public.has_facility_access(uuid, uuid)',
    'public.is_platform_staff(uuid)',
    'public.is_internal_user(uuid)',
    'public.can_read_job(uuid)',
    'public.can_edit_template(uuid)',
    'public.cap_can_access(uuid)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', fn);
  END LOOP;
END $$;

-- 3. Defence in depth: these helpers already refuse to answer for any user other
--    than the caller. Re-assert that guard on the two that gate job/template
--    access so a signed-in user cannot probe another tenant's rows.
CREATE OR REPLACE FUNCTION public.can_read_job(_job_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT auth.uid() IS NOT NULL AND (
    public.is_platform_staff(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.jobs j
      JOIN public.organization_members m ON m.organization_id = j.organization_id
      WHERE j.id = _job_id AND m.user_id = auth.uid()
    )
  );
$function$;

REVOKE ALL ON FUNCTION public.can_read_job(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_read_job(uuid) TO authenticated;
