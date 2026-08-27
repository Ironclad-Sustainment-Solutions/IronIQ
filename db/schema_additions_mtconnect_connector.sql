-- Real MTConnect live connector. Builds on the shop-floor machine master
-- (schema_additions_shop_floor.sql), which explicitly shipped with
-- "no live connector" -- protocol/connection_status columns already
-- anticipated this, they just had nothing behind them yet.
--
-- MTConnect (https://www.mtconnect.org/) is the only one of the three
-- protocols in shop_machine_protocol (mtconnect, opc_ua, fanuc_focas)
-- that's a plain HTTP+XML REST API with a public, stable spec -- OPC-UA
-- needs a binary protocol client library and FOCAS needs Fanuc's own
-- vendor SDK, neither of which can be meaningfully built or tested from
-- a sandboxed dev environment. This adds real MTConnect support only.

ALTER TABLE public.shop_machines
  ADD COLUMN IF NOT EXISTS mtconnect_agent_url TEXT,
  ADD COLUMN IF NOT EXISTS mtconnect_device_name TEXT,
  -- Operator-set fallback for which part is currently running, used only
  -- when the agent's /current response has no PartNumber-type DataItem
  -- to read directly. Real MTConnect implementations vary on whether
  -- they expose this at all.
  ADD COLUMN IF NOT EXISTS current_part_number TEXT;

DO $$ BEGIN
  ALTER TYPE public.shop_run_source ADD VALUE IF NOT EXISTS 'live';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- One row per machine, tracking the last successful (or failed) poll so
-- the next poll can compute a delta (time in each execution state, parts
-- completed since last check) instead of just a point-in-time snapshot.
CREATE TABLE IF NOT EXISTS public.shop_machine_live_state (
  machine_id UUID PRIMARY KEY REFERENCES public.shop_machines(id) ON DELETE CASCADE,
  last_polled_at TIMESTAMPTZ,
  last_sequence BIGINT,
  last_execution TEXT,
  last_part_count NUMERIC,
  last_part_number TEXT,
  last_error TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.shop_machine_live_state TO app_user;
GRANT ALL ON public.shop_machine_live_state TO app_admin;
ALTER TABLE public.shop_machine_live_state ENABLE ROW LEVEL SECURITY;

-- No organization_id/facility_id of its own -- inherits access from the
-- machine it belongs to via a join, matching the same one-hop pattern
-- already used for the CAD/CNC/assessment product-restriction resolvers.
DROP POLICY IF EXISTS "shop_machine_live_state via machine" ON public.shop_machine_live_state;
CREATE POLICY "shop_machine_live_state via machine" ON public.shop_machine_live_state FOR ALL TO app_user
  USING (
    EXISTS (
      SELECT 1 FROM public.shop_machines m
       WHERE m.id = machine_id
         AND private.has_org_access(public.current_user_id(), m.organization_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.shop_machines m
       WHERE m.id = machine_id
         AND private.has_org_access(public.current_user_id(), m.organization_id)
    )
  );

DROP TRIGGER IF EXISTS t_shop_machine_live_state_upd ON public.shop_machine_live_state;
CREATE TRIGGER t_shop_machine_live_state_upd BEFORE UPDATE ON public.shop_machine_live_state
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
