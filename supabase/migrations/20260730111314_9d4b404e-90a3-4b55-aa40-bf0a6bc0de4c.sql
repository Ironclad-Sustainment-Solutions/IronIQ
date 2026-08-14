-- 1. audit_logs: restrict inserts to the acting user and their accessible scope
DROP POLICY IF EXISTS "audit insert" ON public.audit_logs;
CREATE POLICY "audit insert" ON public.audit_logs
FOR INSERT TO authenticated
WITH CHECK (
  actor_id = auth.uid()
  AND (organization_id IS NULL OR public.has_org_access(auth.uid(), organization_id))
  AND (facility_id IS NULL OR public.has_facility_access(auth.uid(), facility_id))
);

-- 2. user_roles: explicit admin-only management path
DROP POLICY IF EXISTS "admins manage roles" ON public.user_roles;
CREATE POLICY "admins manage roles" ON public.user_roles
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'ironiq_admin'))
WITH CHECK (public.has_role(auth.uid(), 'ironiq_admin'));

GRANT INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;

-- 3. Lock down SECURITY DEFINER / internal functions
-- Internal trigger + bootstrap helpers: not callable by any API role
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_response_editable() FROM PUBLIC, anon, authenticated;

-- Access-check helpers are required by RLS policies for signed-in users only
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_platform_staff(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_org_access(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_facility_access(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.next_finding_code() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_platform_staff(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_org_access(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_facility_access(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.next_finding_code() TO authenticated;