-- =====================================================================
-- Product access restriction — org-level only, open by default.
--
-- Confirmed design (per direct decision): a DENY list, not a grant list.
-- No row for (org, product) = that product is available, matching how
-- every existing organization already behaves today. A row's mere
-- EXISTENCE is the restriction — no separate enabled boolean needed,
-- since there's nothing to toggle other than presence/absence.
--
-- Depends on schema_additions_intelligence_layer.sql being applied
-- first (reuses its intelligence_product enum, same as
-- schema_additions_cad_conversion.sql already does) — apply that file
-- before this one if it hasn't been already.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.organization_product_restrictions (
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  product public.intelligence_product NOT NULL,
  restricted_by UUID,
  restricted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, product)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_product_restrictions TO app_user;
GRANT ALL ON public.organization_product_restrictions TO app_admin;
ALTER TABLE public.organization_product_restrictions ENABLE ROW LEVEL SECURITY;

-- Any member of the org can READ their own org's restriction list (the
-- app needs this to correctly hide nav items client-side) — but writing
-- (adding/removing a restriction) is a platform-staff action, same
-- reasoning as the Intelligence Layer's pattern review gate.
DROP POLICY IF EXISTS "org_product_restrictions read own org" ON public.organization_product_restrictions;
CREATE POLICY "org_product_restrictions read own org" ON public.organization_product_restrictions FOR SELECT TO app_user
  USING (
    private.has_org_access(public.current_user_id(), organization_id)
    OR private.is_platform_staff(public.current_user_id())
  );

DROP POLICY IF EXISTS "org_product_restrictions write by platform staff" ON public.organization_product_restrictions;
CREATE POLICY "org_product_restrictions write by platform staff" ON public.organization_product_restrictions FOR ALL TO app_user
  USING (private.is_platform_staff(public.current_user_id()))
  WITH CHECK (private.is_platform_staff(public.current_user_id()));
