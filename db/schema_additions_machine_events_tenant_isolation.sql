-- =====================================================================
-- Tenant isolation for IronIQ Edge machine events.
--
-- Two shops can share an asset_id (UNIQUE is per facility, not global).
-- The original idempotency key was (machine_id, ts_utc, event_type,
-- cycle_seq) with no organization/facility, so Company A's accepted
-- event could block Company B from writing the same machine_id+instant
-- (treated as a duplicate) — a write isolation hole.
--
-- Ingest also runs as app_admin (RLS bypassed), so inserts must be
-- bound to the organization that owns the facility and shop machine,
-- not asset_id alone. The trigger below rejects a row whose org,
-- facility, or shop_machine_id do not line up.
-- =====================================================================

ALTER TABLE public.shop_machine_events
  DROP CONSTRAINT IF EXISTS shop_machine_events_idempotency;

ALTER TABLE public.shop_machine_events
  ADD CONSTRAINT shop_machine_events_idempotency
  UNIQUE NULLS NOT DISTINCT (
    organization_id, facility_id, machine_id, ts_utc, event_type, cycle_seq
  );

CREATE INDEX IF NOT EXISTS idx_shop_machine_events_org_fac_machine_ts
  ON public.shop_machine_events(organization_id, facility_id, machine_id, ts_utc);

CREATE OR REPLACE FUNCTION public.shop_machine_events_align_tenant()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  fac_org UUID;
  mach_org UUID;
  mach_fac UUID;
  mach_asset TEXT;
BEGIN
  SELECT organization_id INTO fac_org
    FROM public.facilities
   WHERE id = NEW.facility_id;
  IF fac_org IS NULL THEN
    RAISE EXCEPTION 'facility_id must reference an existing facility';
  END IF;
  IF fac_org <> NEW.organization_id THEN
    RAISE EXCEPTION 'facility_id must belong to organization_id';
  END IF;

  SELECT organization_id, facility_id, asset_id
    INTO mach_org, mach_fac, mach_asset
    FROM public.shop_machines
   WHERE id = NEW.shop_machine_id;
  IF mach_org IS NULL THEN
    RAISE EXCEPTION 'shop_machine_id must reference an existing machine';
  END IF;
  IF mach_org <> NEW.organization_id OR mach_fac <> NEW.facility_id THEN
    RAISE EXCEPTION 'shop_machine_id must belong to organization_id and facility_id';
  END IF;
  IF mach_asset <> NEW.machine_id THEN
    RAISE EXCEPTION 'machine_id must match shop_machines.asset_id';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS t_shop_machine_events_align_tenant
  ON public.shop_machine_events;
CREATE TRIGGER t_shop_machine_events_align_tenant
  BEFORE INSERT OR UPDATE ON public.shop_machine_events
  FOR EACH ROW EXECUTE FUNCTION public.shop_machine_events_align_tenant();
