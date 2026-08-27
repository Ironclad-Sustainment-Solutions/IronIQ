-- Persist company/facility from the public request-access form onto
-- profiles so an admin can see them when approving an account.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS requested_company text,
  ADD COLUMN IF NOT EXISTS requested_facility text;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (
    id, email, full_name, job_title, approved,
    requested_company, requested_facility
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'job_title',
    false,
    NULLIF(NEW.raw_user_meta_data->>'requested_company', ''),
    NULLIF(NEW.raw_user_meta_data->>'requested_facility', '')
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'executive') ON CONFLICT DO NOTHING;

  RETURN NEW;
END; $$;
