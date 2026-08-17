-- =====================================================================
-- Business Development — internal-only CRM for tracking prospective
-- customers and business development status. Entirely separate from
-- the customer-facing organizations table: a prospect isn't a customer
-- yet, might never become one, and none of this should ever be visible
-- to a real customer's own users. Restricted to platform staff
-- (ironiq_admin, consultant) via is_platform_staff(), same function
-- already used for the Intelligence Layer's pattern review gate.
-- =====================================================================

CREATE TYPE public.prospect_stage AS ENUM (
  'lead', 'qualifying', 'proposal_sent', 'negotiation', 'won', 'lost'
);

CREATE TABLE IF NOT EXISTS public.prospects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL,
  industry TEXT,
  stage public.prospect_stage NOT NULL DEFAULT 'lead',
  estimated_value NUMERIC(12,2),
  expected_close_date DATE,
  lost_reason TEXT,
  assigned_to UUID,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.prospect_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id UUID NOT NULL REFERENCES public.prospects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  title TEXT,
  email TEXT,
  phone TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.prospect_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id UUID NOT NULL REFERENCES public.prospects(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.prospect_meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id UUID NOT NULL REFERENCES public.prospects(id) ON DELETE CASCADE,
  meeting_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  attendees TEXT,
  summary TEXT,
  next_steps TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prospect_contacts_prospect ON public.prospect_contacts(prospect_id);
CREATE INDEX IF NOT EXISTS idx_prospect_notes_prospect ON public.prospect_notes(prospect_id);
CREATE INDEX IF NOT EXISTS idx_prospect_meetings_prospect ON public.prospect_meetings(prospect_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.prospects TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prospect_contacts TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prospect_notes TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prospect_meetings TO app_user;
GRANT ALL ON public.prospects TO app_admin;
GRANT ALL ON public.prospect_contacts TO app_admin;
GRANT ALL ON public.prospect_notes TO app_admin;
GRANT ALL ON public.prospect_meetings TO app_admin;

ALTER TABLE public.prospects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prospect_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prospect_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prospect_meetings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "prospects platform staff only" ON public.prospects;
CREATE POLICY "prospects platform staff only" ON public.prospects FOR ALL TO app_user
  USING (private.is_platform_staff(public.current_user_id()))
  WITH CHECK (private.is_platform_staff(public.current_user_id()));

DROP POLICY IF EXISTS "prospect_contacts platform staff only" ON public.prospect_contacts;
CREATE POLICY "prospect_contacts platform staff only" ON public.prospect_contacts FOR ALL TO app_user
  USING (private.is_platform_staff(public.current_user_id()))
  WITH CHECK (private.is_platform_staff(public.current_user_id()));

DROP POLICY IF EXISTS "prospect_notes platform staff only" ON public.prospect_notes;
CREATE POLICY "prospect_notes platform staff only" ON public.prospect_notes FOR ALL TO app_user
  USING (private.is_platform_staff(public.current_user_id()))
  WITH CHECK (private.is_platform_staff(public.current_user_id()));

DROP POLICY IF EXISTS "prospect_meetings platform staff only" ON public.prospect_meetings;
CREATE POLICY "prospect_meetings platform staff only" ON public.prospect_meetings FOR ALL TO app_user
  USING (private.is_platform_staff(public.current_user_id()))
  WITH CHECK (private.is_platform_staff(public.current_user_id()));
