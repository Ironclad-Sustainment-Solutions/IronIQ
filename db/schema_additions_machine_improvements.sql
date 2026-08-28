-- =====================================================================
-- Saved machine-change windows for Grede-style capture V1.
--
-- Records *when* a change happened (title, machine, part, windows).
-- Before/after numbers are NOT stored here and are NOT typed in — they
-- are queried from machine events (sibling ingest PR). This table is
-- additive: public.part_outcome_cards (typed before/after) stays as-is.
--
-- machine_id references public.shop_machines, not public.machines
-- (the RFQ/estimating catalog). Grede "plant" is IronIQ's facility:
-- plant_id is the facility UUID (CHECK plant_id = facility_id).
--
-- Does NOT create a machine events table. Ingest owns that schema;
-- query helpers treat a missing events relation as "cannot compute".
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.shop_machine_improvements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  facility_id UUID NOT NULL REFERENCES public.facilities(id) ON DELETE CASCADE,
  plant_id UUID NOT NULL REFERENCES public.facilities(id) ON DELETE CASCADE,
  part_id UUID NOT NULL REFERENCES public.shop_parts(id) ON DELETE CASCADE,
  machine_id UUID NOT NULL REFERENCES public.shop_machines(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL,
  window_before_hours NUMERIC NOT NULL CHECK (window_before_hours > 0),
  window_after_hours NUMERIC NOT NULL CHECK (window_after_hours > 0),
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT shop_machine_improvements_plant_is_facility
    CHECK (plant_id = facility_id)
);

CREATE INDEX IF NOT EXISTS idx_shop_machine_improvements_org
  ON public.shop_machine_improvements(organization_id);
CREATE INDEX IF NOT EXISTS idx_shop_machine_improvements_facility
  ON public.shop_machine_improvements(facility_id);
CREATE INDEX IF NOT EXISTS idx_shop_machine_improvements_machine
  ON public.shop_machine_improvements(machine_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_shop_machine_improvements_part
  ON public.shop_machine_improvements(part_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.shop_machine_improvements TO app_user;
GRANT ALL ON public.shop_machine_improvements TO app_admin;
ALTER TABLE public.shop_machine_improvements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shop_machine_improvements org access" ON public.shop_machine_improvements;
CREATE POLICY "shop_machine_improvements org access" ON public.shop_machine_improvements FOR ALL TO app_user
  USING (private.has_org_access(public.current_user_id(), organization_id))
  WITH CHECK (private.has_org_access(public.current_user_id(), organization_id));

DROP TRIGGER IF EXISTS t_shop_machine_improvements_upd ON public.shop_machine_improvements;
CREATE TRIGGER t_shop_machine_improvements_upd BEFORE UPDATE ON public.shop_machine_improvements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
