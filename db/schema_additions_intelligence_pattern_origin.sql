-- Distinguishes a curated "reference library" pattern (a genuine,
-- human-authored, commonly-known industry pattern -- not derived from
-- any specific customer engagement) from a real engagement-derived one
-- (source_event_id set, captured from an actual closed finding with
-- consent). Both are retrieved and drafted from identically by
-- precedent-draft.functions.ts and ask-ironiq.functions.ts, but the
-- distinction matters for honesty: when a draft cites "per pattern 2",
-- the reader should be able to tell whether that's a real precedent from
-- a past engagement or a general industry pattern Ironclad staff curated
-- as a reasonable starting point. Existing rows all default to
-- 'engagement_derived', which is accurate for every pattern that existed
-- before this column -- they were all captured from real closed findings.
--
-- Exists specifically to solve a cold-start problem: intelligence_patterns
-- only fills up from real customer engagements over time, so a brand-new
-- customer's first assessment (or the whole platform's early days) has
-- nothing to match against and gets an honest "no precedent found" every
-- time. A small library of curated reference patterns gives early
-- customers some real, grounded value from day one, without pretending
-- it's the same kind of evidence as an actual resolved engagement.

DO $$ BEGIN
  CREATE TYPE public.intelligence_pattern_origin AS ENUM (
    'engagement_derived',
    'reference_library'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.intelligence_patterns
  ADD COLUMN IF NOT EXISTS origin public.intelligence_pattern_origin
    NOT NULL DEFAULT 'engagement_derived';

CREATE INDEX IF NOT EXISTS idx_intelligence_patterns_origin
  ON public.intelligence_patterns(origin);
