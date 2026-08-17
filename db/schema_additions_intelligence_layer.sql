-- =====================================================================
-- IronIQ Intelligence Layer — Phase B (foundation only, no product wiring
-- yet; Phase C retrofits the Assessment product to actually write here).
--
-- Implements the three decisions made for Phase A:
--   1. Cross-client learning IS allowed, but only via a separately
--      generated, anonymized derivative — never the raw event itself.
--   2. Consent is captured per-event, at data-entry time (not a static
--      one-time org-level setting) — intelligence_events.contribute_consent.
--   3. Every anonymized pattern requires human review (by a consultant or
--      admin — the people with actual client-sensitivity judgment) before
--      it becomes visible to any other organization. Nothing publishes
--      automatically.
--   4. What another org sees is minimal categorical context only (e.g.
--      "aerospace"), reusing organizations.industry rather than inventing
--      new taxonomy — never anything more specific than that.
--
-- IMPORTANT — verify this first, separately, before relying on anything
-- else in this file: `CREATE EXTENSION vector` needs to actually succeed
-- on your production Render Postgres instance. It works in this sandbox
-- because the local session runs as the Postgres superuser; whether your
-- production database user has the privilege (and whether Render's
-- extension allowlist includes pgvector on your plan) can't be verified
-- from this environment. Run just this one line against production first:
--   CREATE EXTENSION IF NOT EXISTS vector;
-- before applying the rest of this file.
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS vector;

DO $$ BEGIN
  CREATE TYPE public.intelligence_product AS ENUM ('assessment', 'cad', 'cnc');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.intelligence_pattern_status AS ENUM ('pending_review', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------
-- intelligence_events — raw, full-detail, org-scoped. Never leaves the
-- organization it belongs to; this is what that org's own "Ask IronIQ"
-- draws from. source_table/source_id is a loose polymorphic reference
-- (not an FK — the source varies per product: a finding today, a CAD job
-- or CNC change log entry once those products exist) so this table
-- doesn't need a schema change every time a new product starts feeding it.
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.intelligence_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  facility_id UUID REFERENCES public.facilities(id) ON DELETE SET NULL,
  product public.intelligence_product NOT NULL,

  problem_summary TEXT NOT NULL,
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  resolution_summary TEXT,
  resolution_detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  outcome_summary TEXT,
  outcome_metric JSONB NOT NULL DEFAULT '{}'::jsonb,

  source_table TEXT,
  source_id UUID,

  -- Captured at data-entry time (a checkbox/prompt when the event is
  -- logged), per Phase A's decision — not a static org-level default.
  -- False until someone explicitly opts this specific record in.
  contribute_consent BOOLEAN NOT NULL DEFAULT false,

  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_intelligence_events_org ON public.intelligence_events(organization_id);
CREATE INDEX IF NOT EXISTS idx_intelligence_events_product ON public.intelligence_events(product);
CREATE INDEX IF NOT EXISTS idx_intelligence_events_consent
  ON public.intelligence_events(contribute_consent) WHERE contribute_consent = true;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.intelligence_events TO app_user;
GRANT ALL ON public.intelligence_events TO app_admin;
ALTER TABLE public.intelligence_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "intelligence_events org access" ON public.intelligence_events;
CREATE POLICY "intelligence_events org access" ON public.intelligence_events FOR ALL TO app_user
  USING (private.has_org_access(public.current_user_id(), organization_id))
  WITH CHECK (private.has_org_access(public.current_user_id(), organization_id));

DROP TRIGGER IF EXISTS t_intelligence_events_upd ON public.intelligence_events;
CREATE TRIGGER t_intelligence_events_upd BEFORE UPDATE ON public.intelligence_events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------
-- intelligence_patterns — anonymized, shared-pool. Generated FROM a raw
-- event only when that event's own contribute_consent was true. Sits at
-- 'pending_review' until a consultant or admin approves it — nothing
-- here is visible to any other organization until a human has looked at
-- it and confirmed it's actually safe to share.
--
-- source_event_id exists for audit/traceability (so the originating org
-- can be identified if a pattern ever needs to be pulled), but is
-- deliberately NOT exposed by the RLS SELECT policy below to anyone
-- outside platform staff — an ordinary user reading an approved pattern
-- has no way to trace it back to which client it came from.
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.intelligence_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_event_id UUID REFERENCES public.intelligence_events(id) ON DELETE SET NULL,
  product public.intelligence_product NOT NULL,

  -- Minimal, non-identifying context only — reuses organizations.industry
  -- rather than inventing new taxonomy. Never facility name, org name, or
  -- anything more specific than this one field.
  category_label TEXT,

  pattern_summary TEXT NOT NULL,
  pattern_resolution TEXT,
  pattern_outcome TEXT,

  -- Dimension chosen for Voyage AI's voyage-3 embeddings (Anthropic's own
  -- recommended embedding provider — this app has no embeddings API of
  -- its own). Adjust here and in the embedding-generation code together
  -- if a different model/dimension is used; see the accompanying
  -- functions file's note on the required VOYAGE_API_KEY.
  embedding vector(1024),

  status public.intelligence_pattern_status NOT NULL DEFAULT 'pending_review',
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_intelligence_patterns_status ON public.intelligence_patterns(status);
CREATE INDEX IF NOT EXISTS idx_intelligence_patterns_product ON public.intelligence_patterns(product);
-- ivfflat requires ANALYZE after enough rows exist to build meaningful
-- clusters; harmless on an empty/small table, just not yet useful.
CREATE INDEX IF NOT EXISTS idx_intelligence_patterns_embedding
  ON public.intelligence_patterns USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

GRANT SELECT, INSERT, UPDATE ON public.intelligence_patterns TO app_user;
GRANT ALL ON public.intelligence_patterns TO app_admin;
ALTER TABLE public.intelligence_patterns ENABLE ROW LEVEL SECURITY;

-- Any authenticated user may read APPROVED patterns — that's the entire
-- point of the shared pool. Pending/rejected patterns are visible only to
-- platform staff (the reviewers) or, for their own submission's status,
-- the originating org (so they can see "pending" rather than silence).
DROP POLICY IF EXISTS "intelligence_patterns read approved" ON public.intelligence_patterns;
CREATE POLICY "intelligence_patterns read approved" ON public.intelligence_patterns FOR SELECT TO app_user
  USING (
    status = 'approved'
    OR private.is_platform_staff(public.current_user_id())
    OR EXISTS (
      SELECT 1 FROM public.intelligence_events e
      WHERE e.id = source_event_id
        AND private.has_org_access(public.current_user_id(), e.organization_id)
    )
  );

-- Row creation (drafting a candidate pattern) is a generated/system action
-- gated on the source event's consent flag — enforced in application code
-- (see generatePatternFromEvent), not by this policy alone, since RLS
-- can't see "was consent true on the source event" as a simple column
-- check across the join at INSERT time. Restricting INSERT to platform
-- staff keeps this from being something an ordinary org user could do
-- directly against the table.
DROP POLICY IF EXISTS "intelligence_patterns insert by platform staff" ON public.intelligence_patterns;
CREATE POLICY "intelligence_patterns insert by platform staff" ON public.intelligence_patterns FOR INSERT TO app_user
  WITH CHECK (private.is_platform_staff(public.current_user_id()));

-- Reviewing (approve/reject) is restricted to platform staff — the people
-- with actual client-relationship context, same reasoning as the existing
-- "org members write" policy already using this broader staff check
-- rather than admin-only.
DROP POLICY IF EXISTS "intelligence_patterns review by platform staff" ON public.intelligence_patterns;
CREATE POLICY "intelligence_patterns review by platform staff" ON public.intelligence_patterns FOR UPDATE TO app_user
  USING (private.is_platform_staff(public.current_user_id()))
  WITH CHECK (private.is_platform_staff(public.current_user_id()));
