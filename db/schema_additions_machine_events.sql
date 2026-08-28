-- =====================================================================
-- IronIQ Edge: iss.machine_event.v1 ingest from an IronIQ Edge box.
--
-- Additive shop-floor table. Does not replace shop_machine_run_events
-- (manual/CSV + MTConnect "Sync now") and does not create a competing
-- machines or plants registry. Spec machine_id maps to
-- shop_machines.asset_id. Spec plant_id is stored as text on the event
-- (any shop's plant label, e.g. a demo value like grede-biscoe).
-- organization_id / facility_id come from the existing shop machine /
-- facility that owns the authenticated edge key — never from plant_id.
--
-- One row per state change or cycle end (or accepted heartbeat / alarm).
-- Not a 10 Hz stream. IronIQ never talks to the CNC; this is edge-push
-- only.
-- =====================================================================

DO $$ BEGIN
  CREATE TYPE public.shop_machine_event_capture_path AS ENUM (
    'mtconnect', 'focas', 'opcua', 'qcodes', 'pmc', 'discrete_io'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.shop_machine_event_type AS ENUM (
    'state_change', 'cycle_end', 'alarm', 'heartbeat'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.shop_machine_event_state AS ENUM (
    'RUNNING', 'IDLE', 'DOWN'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.shop_machine_event_gap_class AS ENUM (
    'SETUP_CANDIDATE', 'FIRST_PIECE_CANDIDATE', 'ALARM'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Haas Q104 / execution mode, Fanuc MEM vs MDI vs JOG/handle.
-- Null when the pipe cannot read mode (e.g. discrete I/O). Not feed override.
DO $$ BEGIN
  CREATE TYPE public.shop_machine_event_control_mode AS ENUM (
    'AUTO', 'MDI', 'JOG'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.shop_machine_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  facility_id UUID NOT NULL REFERENCES public.facilities(id) ON DELETE CASCADE,
  shop_machine_id UUID NOT NULL REFERENCES public.shop_machines(id) ON DELETE CASCADE,

  -- Spec contract. event_schema stores spec field "schema".
  event_schema TEXT NOT NULL DEFAULT 'iss.machine_event.v1'
    CHECK (event_schema = 'iss.machine_event.v1'),
  plant_id TEXT NOT NULL,
  source_system TEXT NOT NULL,
  -- Spec machine_id: shop_machines.asset_id, stored as posted.
  machine_id TEXT NOT NULL,
  machine_serial TEXT,
  controller_make TEXT,
  controller_model TEXT,
  capture_path public.shop_machine_event_capture_path NOT NULL,
  event_type public.shop_machine_event_type NOT NULL,
  ts_utc TIMESTAMPTZ NOT NULL,
  state public.shop_machine_event_state NOT NULL,
  prev_state public.shop_machine_event_state,
  program_name TEXT,
  part_id TEXT,
  job_id TEXT,
  cycle_seq INTEGER,
  cycle_time_s NUMERIC,
  runtime_cutting_s NUMERIC,
  spindle_on_s NUMERIC,
  idle_since_prev_cycle_s NUMERIC,
  gap_class public.shop_machine_event_gap_class,
  alarm_code TEXT,
  alarm_active BOOLEAN,
  control_mode public.shop_machine_event_control_mode,
  quality JSONB,

  ingested_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT shop_machine_events_idempotency
    UNIQUE NULLS NOT DISTINCT (organization_id, facility_id, machine_id, ts_utc, event_type, cycle_seq)
);

CREATE INDEX IF NOT EXISTS idx_shop_machine_events_machine_ts
  ON public.shop_machine_events(machine_id, ts_utc);
CREATE INDEX IF NOT EXISTS idx_shop_machine_events_part_ts
  ON public.shop_machine_events(part_id, ts_utc);
CREATE INDEX IF NOT EXISTS idx_shop_machine_events_shop_machine
  ON public.shop_machine_events(shop_machine_id);

ALTER TABLE public.shop_machine_events
  ADD COLUMN IF NOT EXISTS control_mode public.shop_machine_event_control_mode;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.shop_machine_events TO app_user;
GRANT ALL ON public.shop_machine_events TO app_admin;
ALTER TABLE public.shop_machine_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shop_machine_events org access" ON public.shop_machine_events;
CREATE POLICY "shop_machine_events org access" ON public.shop_machine_events FOR ALL TO app_user
  USING (private.has_org_access(public.current_user_id(), organization_id))
  WITH CHECK (private.has_org_access(public.current_user_id(), organization_id));
