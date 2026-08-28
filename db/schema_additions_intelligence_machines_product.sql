-- Extends the Intelligence layer (intelligence_patterns/intelligence_events)
-- to cover Machines/IronIQ Edge -- previously intelligence_product only
-- had assessment/cad/cnc, meaning Ask IronIQ was architecturally blind
-- to every bit of shop-floor data added this session (run events, floor
-- status, improvements, parts).
--
-- Pattern capture (the "resolved problem -> anonymized precedent, with
-- consent" flow already used for assessment findings and CNC change log
-- entries) maps naturally onto shop_machine_improvements: a saved
-- before/after change window IS a resolved problem with a measurable
-- outcome, the same shape as a closed finding or a CNC log entry. Raw
-- telemetry (shop_machine_events, shop_machine_run_events) has no
-- analogous "resolved precedent" concept -- there's nothing to consent
-- to share, it's just current state -- so that's handled differently
-- (see ask-ironiq.functions.ts's live floor-snapshot context, not
-- pattern capture).

DO $$ BEGIN
  ALTER TYPE public.intelligence_product ADD VALUE IF NOT EXISTS 'machines';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
