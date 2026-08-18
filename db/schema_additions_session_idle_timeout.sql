-- Idle-timeout tracking for sessions. Previously app_sessions only had an
-- absolute expires_at (30 days from login) and no idle timeout at all --
-- a stolen session cookie stayed valid for up to 30 days of continuous
-- use by an attacker regardless of whether the real user was still
-- active. This adds last_seen_at, updated on each authenticated request
-- (throttled -- see src/lib/auth/session.ts), so a session that goes
-- unused for the idle window expires long before its absolute ceiling.

ALTER TABLE public.app_sessions
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS app_sessions_last_seen_at_idx
  ON public.app_sessions(last_seen_at);
