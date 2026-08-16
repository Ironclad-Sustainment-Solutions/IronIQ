-- =====================================================================
-- Account approval + safe signup defaults.
--
-- Found while building this: every new signup currently auto-receives
-- the 'consultant' global role (which grants access to EVERY organization
-- via is_platform_staff/has_org_access) AND auto-joins whichever
-- organization was created first — with no approval step at all. For a
-- multi-tenant app about to hold real client data, that's a real gap,
-- not a nice-to-have. This migration closes it:
--   1. New signups default to approved = false and cannot log in until
--      an admin approves them (see the login() change in
--      src/lib/auth/auth.functions.ts).
--   2. New signups get the least-privileged role ('executive', which has
--      zero capabilities per src/context/app-context.tsx's CAPABILITIES
--      map) instead of 'consultant'.
--   3. New signups are NOT auto-joined to any organization. An admin
--      attaches them to the org(s) they actually belong to.
--   4. Existing users are unaffected: the new `approved` column defaults
--      to true at the table level, so every row that already exists
--      keeps working exactly as before. Only the trigger for brand-new
--      signups explicitly sets it to false.
-- =====================================================================

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS approved boolean NOT NULL DEFAULT true;

-- Mirrors the existing "admins manage roles" policy on user_roles exactly
-- (same has_role(..., 'ironiq_admin') check) — additive alongside the
-- existing "own profile update" policy, so a user can still update their
-- own profile AND an admin can now update anyone's.
DROP POLICY IF EXISTS "admins approve profiles" ON public.profiles;
CREATE POLICY "admins approve profiles" ON public.profiles
FOR UPDATE TO app_user
USING (private.has_role(public.current_user_id(), 'ironiq_admin'))
WITH CHECK (private.has_role(public.current_user_id(), 'ironiq_admin'));

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, job_title, approved)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'job_title',
    false
  )
  ON CONFLICT (id) DO NOTHING;

  -- Least-privilege default. An admin assigns the real role (and org
  -- membership, separately) after reviewing the account.
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'executive') ON CONFLICT DO NOTHING;

  -- Deliberately no organization_members insert here anymore — see the
  -- header comment. New users start with zero organization access.
  RETURN NEW;
END; $$;

-- ---------------------------------------------------------------------
-- One-time bootstrap: grant noah.osman@ironcladsustainment.com admin
-- access. Idempotent and safe to re-run — a no-op if the account doesn't
-- exist yet (sign up first, then re-run this file) or already has the
-- role.
-- ---------------------------------------------------------------------
DO $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM public.app_users WHERE email = 'noah.osman@ironcladsustainment.com';
  IF v_user_id IS NOT NULL THEN
    UPDATE public.profiles SET approved = true WHERE id = v_user_id;
    -- Replace, not stack — clears the least-privilege 'executive' default
    -- from signup so this account ends up with exactly one clean role,
    -- matching how the admin UI models "set this person's role" as well.
    DELETE FROM public.user_roles WHERE user_id = v_user_id;
    INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'ironiq_admin');
    RAISE NOTICE 'Granted ironiq_admin + approved=true to noah.osman@ironcladsustainment.com';
  ELSE
    RAISE NOTICE 'noah.osman@ironcladsustainment.com has no account yet — sign up first, then re-run this file (or just the DO block above) to grant admin.';
  END IF;
END $$;
