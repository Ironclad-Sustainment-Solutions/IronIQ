-- Suppliers, under Capability -- previously deferred as genuinely new
-- work (confirmed at the time: `supplier` only existed as a scattered
-- free-text field on materials/tooling/consumables in Production
-- Libraries, with no dedicated entity, list, or management page at all).
--
-- This is a standalone supplier directory, not yet linked back to those
-- existing free-text supplier fields on materials/tooling/consumables --
-- that backfill/link-up is a real, separate follow-on step, deliberately
-- not attempted here to keep this change reviewable on its own.

CREATE TABLE public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  facility_id UUID REFERENCES public.facilities(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  -- Free text, not an enum -- a real supplier often covers more than one
  -- category (e.g. both tooling and consumables), and the actual set of
  -- categories a shop cares about varies enough that a fixed enum would
  -- likely need frequent changes to stay useful.
  category TEXT,
  primary_contact_name TEXT,
  primary_contact_email TEXT,
  primary_contact_phone TEXT,
  lead_time_days INTEGER CHECK (lead_time_days IS NULL OR lead_time_days >= 0),
  quality_notes TEXT,
  status public.entity_status NOT NULL DEFAULT 'active',
  archived BOOLEAN NOT NULL DEFAULT false,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_suppliers_organization ON public.suppliers(organization_id);
CREATE INDEX idx_suppliers_facility ON public.suppliers(facility_id) WHERE facility_id IS NOT NULL;

CREATE TRIGGER t_suppliers_updated BEFORE UPDATE ON public.suppliers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

-- Same read/write model as facilities: anyone with access to the
-- organization can read and manage its suppliers -- this is operational
-- data a facility's own team maintains day to day, not something
-- gated to platform staff the way organizations themselves are.
-- private.has_org_access, not public.has_org_access -- confirmed against
-- the live database and every recent schema_additions file; an older
-- policy earlier in schema.sql references public.has_org_access, but
-- that's a stale leftover, not the actual current function location.
CREATE POLICY "suppliers read" ON public.suppliers FOR SELECT TO app_user
  USING (private.has_org_access(public.current_user_id(), organization_id));
CREATE POLICY "suppliers write" ON public.suppliers FOR ALL TO app_user
  USING (private.has_org_access(public.current_user_id(), organization_id))
  WITH CHECK (private.has_org_access(public.current_user_id(), organization_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.suppliers TO app_user;
GRANT ALL ON public.suppliers TO app_admin;
