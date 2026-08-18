-- Rate limiting for login/signup. Nothing previously throttled repeated
-- attempts against auth.functions.ts's login()/signup() -- both were open
-- to unlimited brute-force / credential-stuffing / signup-spam attempts.
--
-- One row per "identifier" (e.g. "login:ip:1.2.3.4" or
-- "login:email:user@example.com") tracking a sliding window of attempts.
-- Rows are read/written with SELECT ... FOR UPDATE from
-- src/lib/auth/rate-limit.server.ts, always inside withAdmin's existing
-- transaction, so concurrent requests for the same identifier serialize
-- correctly instead of racing.

CREATE TABLE IF NOT EXISTS public.auth_rate_limits (
  identifier TEXT PRIMARY KEY,
  attempt_count INT NOT NULL DEFAULT 1,
  window_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  locked_until TIMESTAMPTZ
);

-- No RLS needed: this table is never read/written with a real user's role
-- (only via withAdmin from the rate-limit helper, before a session exists),
-- and it holds no data more sensitive than "this IP/email attempted auth
-- N times." Sized to self-clean naturally -- old rows are overwritten on
-- the next attempt for that identifier, and there's no per-user growth
-- since login attempts for accounts that stop being attempted just stop
-- getting new rows.

GRANT ALL ON public.auth_rate_limits TO app_admin;
