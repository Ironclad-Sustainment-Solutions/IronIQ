-- =====================================================================
-- Broadens prospect_meetings to log ANY interaction (call, email, or
-- meeting), not just formal meetings — per direct feedback: "track
-- every single interaction and meeting while in the growth stage."
-- Additive only; existing rows default to 'meeting' so nothing already
-- logged silently becomes miscategorized.
-- =====================================================================

CREATE TYPE public.prospect_interaction_type AS ENUM ('meeting', 'call', 'email', 'other');

ALTER TABLE public.prospect_meetings
  ADD COLUMN IF NOT EXISTS interaction_type public.prospect_interaction_type NOT NULL DEFAULT 'meeting';
