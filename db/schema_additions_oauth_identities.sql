-- Adds Google and Microsoft 365 (Entra ID) sign-in, linked to the same
-- app_users/profiles the existing password auth uses -- an OAuth sign-in
-- is not a separate account type, it's an additional way to sign into
-- the exact same account, subject to the exact same rules.
--
-- Specifically: a brand-new user signing in via Google/Microsoft for the
-- first time goes through the identical new-account path password signup
-- already uses (the handle_new_user() trigger fires the same way on the
-- app_users INSERT, so approved defaults to false, the least-privileged
-- role is assigned, and no organization is auto-joined -- see
-- schema_additions_user_approval.sql, which this deliberately does not
-- touch or re-implement). An OAuth account is exactly as unapproved as a
-- password account until an admin says otherwise.

ALTER TABLE public.app_users ALTER COLUMN password_hash DROP NOT NULL;
-- A pure-OAuth account (never sets a password) has no password_hash to
-- verify against -- login() already needs to handle NULL here rather
-- than crash bcrypt on a null input, or worse, silently accept anything.

CREATE TABLE public.oauth_identities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('google', 'microsoft')),
  -- The provider's own stable subject identifier (Google's `sub`,
  -- Microsoft's `oid`) -- never the email, which a provider account can
  -- change; this is what actually identifies "the same account" on
  -- repeat sign-ins.
  provider_user_id TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- One binding per (provider, that provider's account) -- prevents two
  -- different IronIQ users from both claiming to be linked to the same
  -- external Google/Microsoft account.
  UNIQUE (provider, provider_user_id),
  -- One binding per (user, provider) -- a user can link both Google AND
  -- Microsoft to their one IronIQ account, but not two different Google
  -- accounts to the same one (which would make "which Google account is
  -- this user" ambiguous).
  UNIQUE (provider, user_id)
);
CREATE INDEX idx_oauth_identities_user_id ON public.oauth_identities(user_id);

GRANT SELECT, INSERT ON public.oauth_identities TO app_admin;
-- Deliberately no app_user grant: identity linking only ever happens
-- from the OAuth callback handler, which runs as withAdmin (there's no
-- current_user_id yet at the point a brand-new account is being
-- created) -- never from an authenticated user's own session.
