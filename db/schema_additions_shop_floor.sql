-- =====================================================================
-- Shop-floor machine master + manual/CSV run events.
--
-- Grede-style physical implementation: identify 1–3 machines, log
-- cycles / runtime / idle / downtime by part, no live connector.
-- Deliberately a new facility-scoped table — public.machines is the
-- RFQ/estimating catalog (internal-only RLS, burden rates, envelopes)
-- and machine_profiles is the production-planning library. This is the
-- shop-floor asset the CNC change log and part card share.
-- =====================================================================

DO $$ BEGIN
  CREATE TYPE public.shop_machine_control AS ENUM (
    'fanuc', 'haas', 'mazak', 'siemens', 'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.shop_machine_protocol AS ENUM (
    'none', 'mtconnect', 'opc_ua', 'fanuc_focas', 'manual'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.shop_machine_connection AS ENUM (
    'not_connected', 'manual', 'live'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.shop_run_source AS ENUM ('manual', 'csv');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.shop_machines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  facility_id UUID NOT NULL REFERENCES public.facilities(id) ON DELETE CASCADE,
  asset_id TEXT NOT NULL,
  name TEXT NOT NULL,
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  control public.shop_machine_control NOT NULL DEFAULT 'other',
  protocol public.shop_machine_protocol NOT NULL DEFAULT 'none',
  connection_status public.shop_machine_connection NOT NULL DEFAULT 'not_connected',
  location TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (facility_id, asset_id)
);

CREATE INDEX IF NOT EXISTS idx_shop_machines_facility
  ON public.shop_machines(facility_id);
CREATE INDEX IF NOT EXISTS idx_shop_machines_org
  ON public.shop_machines(organization_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.shop_machines TO app_user;
GRANT ALL ON public.shop_machines TO app_admin;
ALTER TABLE public.shop_machines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shop_machines org access" ON public.shop_machines;
CREATE POLICY "shop_machines org access" ON public.shop_machines FOR ALL TO app_user
  USING (private.has_org_access(public.current_user_id(), organization_id))
  WITH CHECK (private.has_org_access(public.current_user_id(), organization_id));

DROP TRIGGER IF EXISTS t_shop_machines_upd ON public.shop_machines;
CREATE TRIGGER t_shop_machines_upd BEFORE UPDATE ON public.shop_machines
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.shop_machine_run_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id UUID NOT NULL REFERENCES public.shop_machines(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  facility_id UUID NOT NULL REFERENCES public.facilities(id) ON DELETE CASCADE,
  occurred_at TIMESTAMPTZ NOT NULL,
  part_number TEXT NOT NULL,
  cycles NUMERIC NOT NULL DEFAULT 0 CHECK (cycles >= 0),
  runtime_minutes NUMERIC NOT NULL DEFAULT 0 CHECK (runtime_minutes >= 0),
  idle_minutes NUMERIC NOT NULL DEFAULT 0 CHECK (idle_minutes >= 0),
  downtime_minutes NUMERIC NOT NULL DEFAULT 0 CHECK (downtime_minutes >= 0),
  source public.shop_run_source NOT NULL DEFAULT 'manual',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shop_run_events_machine
  ON public.shop_machine_run_events(machine_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_shop_run_events_part
  ON public.shop_machine_run_events(machine_id, part_number);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.shop_machine_run_events TO app_user;
GRANT ALL ON public.shop_machine_run_events TO app_admin;
ALTER TABLE public.shop_machine_run_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shop_run_events org access" ON public.shop_machine_run_events;
CREATE POLICY "shop_run_events org access" ON public.shop_machine_run_events FOR ALL TO app_user
  USING (private.has_org_access(public.current_user_id(), organization_id))
  WITH CHECK (private.has_org_access(public.current_user_id(), organization_id));

-- CNC change log shares the same machine IDs. machine_name stays as the
-- display snapshot so older free-text entries remain readable.
ALTER TABLE public.cnc_change_log
  ADD COLUMN IF NOT EXISTS machine_id UUID REFERENCES public.shop_machines(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_cnc_change_log_machine
  ON public.cnc_change_log(machine_id);
