-- =====================================================================
-- Program → part map for Grede-style machine capture V1.
--
-- CNC controls send an O-number (O1234), not a part number. IronIQ maps
-- that program name to a part. A scan (a second validity window) is only
-- needed when the same program is later used on a different part.
--
-- plant_id is the shop-floor facility (public.facilities). There is no
-- separate plants table. public.machines remains the RFQ catalog;
-- public.shop_machines remains the shop-floor asset master.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.shop_machine_program_parts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  facility_id UUID NOT NULL REFERENCES public.facilities(id) ON DELETE CASCADE,
  plant_id UUID NOT NULL REFERENCES public.facilities(id) ON DELETE CASCADE,
  program_name TEXT NOT NULL,
  part_id TEXT NOT NULL,
  valid_from TIMESTAMPTZ NOT NULL,
  valid_to TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT shop_machine_program_parts_plant_is_facility
    CHECK (plant_id = facility_id),
  CONSTRAINT shop_machine_program_parts_window
    CHECK (valid_to IS NULL OR valid_to > valid_from),
  CONSTRAINT shop_machine_program_parts_natural_key
    UNIQUE (plant_id, program_name, valid_from)
);

CREATE INDEX IF NOT EXISTS idx_shop_machine_program_parts_org
  ON public.shop_machine_program_parts(organization_id);
CREATE INDEX IF NOT EXISTS idx_shop_machine_program_parts_lookup
  ON public.shop_machine_program_parts(plant_id, program_name, valid_from DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.shop_machine_program_parts TO app_user;
GRANT ALL ON public.shop_machine_program_parts TO app_admin;
ALTER TABLE public.shop_machine_program_parts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shop_machine_program_parts org access"
  ON public.shop_machine_program_parts;
CREATE POLICY "shop_machine_program_parts org access"
  ON public.shop_machine_program_parts FOR ALL TO app_user
  USING (private.has_org_access(public.current_user_id(), organization_id))
  WITH CHECK (private.has_org_access(public.current_user_id(), organization_id));

DROP TRIGGER IF EXISTS t_shop_machine_program_parts_upd
  ON public.shop_machine_program_parts;
CREATE TRIGGER t_shop_machine_program_parts_upd
  BEFORE UPDATE ON public.shop_machine_program_parts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Keep organization_id aligned with the plant (facility) it belongs to.
CREATE OR REPLACE FUNCTION public.shop_machine_program_parts_align_org()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  fac_org UUID;
BEGIN
  SELECT organization_id INTO fac_org
    FROM public.facilities
   WHERE id = NEW.plant_id;
  IF fac_org IS NULL THEN
    RAISE EXCEPTION 'plant_id must reference an existing facility';
  END IF;
  IF fac_org <> NEW.organization_id THEN
    RAISE EXCEPTION 'plant_id must belong to organization_id';
  END IF;
  NEW.facility_id := NEW.plant_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS t_shop_machine_program_parts_align_org
  ON public.shop_machine_program_parts;
CREATE TRIGGER t_shop_machine_program_parts_align_org
  BEFORE INSERT OR UPDATE ON public.shop_machine_program_parts
  FOR EACH ROW EXECUTE FUNCTION public.shop_machine_program_parts_align_org();

-- Half-open [valid_from, valid_to): adjacent windows are allowed; overlap is not.
CREATE OR REPLACE FUNCTION public.shop_machine_program_parts_no_overlap()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM public.shop_machine_program_parts p
     WHERE p.plant_id = NEW.plant_id
       AND p.program_name = NEW.program_name
       AND p.id IS DISTINCT FROM NEW.id
       AND tstzrange(p.valid_from, p.valid_to, '[)')
        && tstzrange(NEW.valid_from, NEW.valid_to, '[)')
  ) THEN
    RAISE EXCEPTION 'Overlapping validity window for the same plant and program';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS t_shop_machine_program_parts_no_overlap
  ON public.shop_machine_program_parts;
CREATE TRIGGER t_shop_machine_program_parts_no_overlap
  BEFORE INSERT OR UPDATE ON public.shop_machine_program_parts
  FOR EACH ROW EXECUTE FUNCTION public.shop_machine_program_parts_no_overlap();

-- Ingest should call this (or the TypeScript resolvePartId helper) on POST.
CREATE OR REPLACE FUNCTION public.resolve_part_id(
  _plant_id UUID,
  _program_name TEXT,
  _at TIMESTAMPTZ DEFAULT now()
) RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT part_id
    FROM public.shop_machine_program_parts
   WHERE plant_id = _plant_id
     AND program_name = btrim(_program_name)
     AND valid_from <= _at
     AND (valid_to IS NULL OR valid_to > _at)
   ORDER BY valid_from DESC
   LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_part_id(UUID, TEXT, TIMESTAMPTZ)
  TO app_user, app_admin;
