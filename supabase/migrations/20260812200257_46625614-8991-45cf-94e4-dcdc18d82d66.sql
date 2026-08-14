-- Explicit, modifiable allowlist for shared reference data access
CREATE TABLE IF NOT EXISTS public.cap_reference_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role,
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cap_reference_access_target_ck CHECK (num_nonnulls(user_id, role) = 1)
);

CREATE UNIQUE INDEX IF NOT EXISTS cap_reference_access_user_uidx ON public.cap_reference_access(user_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS cap_reference_access_role_uidx ON public.cap_reference_access(role) WHERE role IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cap_reference_access TO authenticated;
GRANT ALL ON public.cap_reference_access TO service_role;

ALTER TABLE public.cap_reference_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cap_reference_access admin manage"
  ON public.cap_reference_access FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'ironiq_admin'))
  WITH CHECK (private.has_role(auth.uid(), 'ironiq_admin'));

DROP TRIGGER IF EXISTS t_cap_reference_access_upd ON public.cap_reference_access;
CREATE TRIGGER t_cap_reference_access_upd BEFORE UPDATE ON public.cap_reference_access
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Single, modifiable gate for reference-table reads
CREATE OR REPLACE FUNCTION private.can_read_cap_reference()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT auth.uid() IS NOT NULL
     AND (
       private.is_internal_user(auth.uid())
       OR EXISTS (
         SELECT 1 FROM public.cap_reference_access a
          WHERE a.user_id = auth.uid()
             OR (a.role IS NOT NULL AND EXISTS (
                  SELECT 1 FROM public.user_roles ur
                   WHERE ur.user_id = auth.uid() AND ur.role = a.role))
       )
     );
$$;

REVOKE ALL ON FUNCTION private.can_read_cap_reference() FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS "cap_domains readable" ON public.cap_domains;
DROP POLICY IF EXISTS "cap_criteria readable" ON public.cap_criteria;

CREATE POLICY "cap_domains read" ON public.cap_domains FOR SELECT TO authenticated
  USING (private.can_read_cap_reference());
CREATE POLICY "cap_domains admin manage" ON public.cap_domains FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'ironiq_admin'))
  WITH CHECK (private.has_role(auth.uid(), 'ironiq_admin'));

CREATE POLICY "cap_criteria read" ON public.cap_criteria FOR SELECT TO authenticated
  USING (private.can_read_cap_reference());
CREATE POLICY "cap_criteria admin manage" ON public.cap_criteria FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'ironiq_admin'))
  WITH CHECK (private.has_role(auth.uid(), 'ironiq_admin'));

REVOKE INSERT, UPDATE, DELETE ON public.cap_domains FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.cap_criteria FROM anon;
REVOKE SELECT ON public.cap_domains FROM anon;
REVOKE SELECT ON public.cap_criteria FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cap_domains TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cap_criteria TO authenticated;
GRANT ALL ON public.cap_domains TO service_role;
GRANT ALL ON public.cap_criteria TO service_role;