CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT _user_id IS NOT NULL
     AND _user_id = auth.uid()
     AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_platform_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT _user_id IS NOT NULL
     AND _user_id = auth.uid()
     AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('ironiq_admin','consultant'));
$$;

CREATE OR REPLACE FUNCTION public.has_org_access(_user_id uuid, _org_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT _user_id IS NOT NULL
     AND _user_id = auth.uid()
     AND (
       public.is_platform_staff(_user_id)
       OR EXISTS (SELECT 1 FROM public.organization_members m WHERE m.user_id = _user_id AND m.organization_id = _org_id)
     );
$$;

CREATE OR REPLACE FUNCTION public.has_facility_access(_user_id uuid, _facility_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT _user_id IS NOT NULL
     AND _user_id = auth.uid()
     AND (
       public.is_platform_staff(_user_id)
       OR EXISTS (
         SELECT 1 FROM public.facilities f
         JOIN public.organization_members m ON m.organization_id = f.organization_id
         WHERE f.id = _facility_id AND m.user_id = _user_id
       )
     );
$$;

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_platform_staff(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_org_access(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_facility_access(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_platform_staff(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_org_access(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_facility_access(uuid, uuid) TO authenticated;