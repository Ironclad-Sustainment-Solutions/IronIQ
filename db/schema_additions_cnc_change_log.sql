-- =====================================================================
-- CNC Coding Enhancement product — Phase F.1: the logging system.
--
-- Per the phased plan, this is deliberately scoped as adoption-first:
-- the AI value ("here's how we solved this exact machining problem
-- before") only exists once there's real logged history to search over.
-- F.2 (AI pattern-matching over this history) is explicitly gated on
-- F.1 actually having real data in it — not built here.
--
-- Mirrors the same closure -> consent -> Intelligence Layer capture
-- pattern already established for findings/corrective_actions/
-- improvement_projects in Phase C, so a verified change log entry feeds
-- intelligence_events (product='cnc') the same way closing a finding
-- does for product='assessment'. This is also the piece Phase E left
-- as a known gap for CAD — CNC gets it from day one instead.
-- =====================================================================

DO $$ BEGIN
  CREATE TYPE public.cnc_change_category AS ENUM (
    'feed_speed', 'toolpath', 'fixture', 'tooling', 'program_logic', 'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.cnc_change_status AS ENUM ('logged', 'verified');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.cnc_change_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  facility_id UUID REFERENCES public.facilities(id) ON DELETE SET NULL,

  machine_name TEXT NOT NULL,
  program_identifier TEXT,
  change_category public.cnc_change_category NOT NULL DEFAULT 'other',
  change_description TEXT NOT NULL,
  reason TEXT NOT NULL,

  -- Populated at verification time, not at initial logging — the whole
  -- point of the adoption-first framing is that the FIRST entry should
  -- be as low-friction as possible (machine, what changed, why), with
  -- the outcome/verification as a separate, later step once the result
  -- is actually known.
  outcome_description TEXT,
  outcome_metric JSONB NOT NULL DEFAULT '{}'::jsonb, -- e.g. {"cycle_time_before_sec": 145, "cycle_time_after_sec": 128}

  status public.cnc_change_status NOT NULL DEFAULT 'logged',
  contribute_consent BOOLEAN NOT NULL DEFAULT false, -- same Phase A semantics as intelligence_events

  logged_by UUID,
  verified_by UUID,
  verified_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cnc_change_log_org ON public.cnc_change_log(organization_id);
CREATE INDEX IF NOT EXISTS idx_cnc_change_log_facility ON public.cnc_change_log(facility_id);
CREATE INDEX IF NOT EXISTS idx_cnc_change_log_status ON public.cnc_change_log(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cnc_change_log TO app_user;
GRANT ALL ON public.cnc_change_log TO app_admin;
ALTER TABLE public.cnc_change_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cnc_change_log org access" ON public.cnc_change_log;
CREATE POLICY "cnc_change_log org access" ON public.cnc_change_log FOR ALL TO app_user
  USING (private.has_org_access(public.current_user_id(), organization_id))
  WITH CHECK (private.has_org_access(public.current_user_id(), organization_id));

DROP TRIGGER IF EXISTS t_cnc_change_log_upd ON public.cnc_change_log;
CREATE TRIGGER t_cnc_change_log_upd BEFORE UPDATE ON public.cnc_change_log
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
