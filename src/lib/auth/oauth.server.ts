// Google and Microsoft 365 (Entra ID) sign-in via arctic, an OAuth2/OIDC
// client library. An OAuth sign-in is not a separate account type from
// password auth -- it's linked to the exact same app_users/profiles rows
// and subject to the exact same approval gate (see login() in
// auth.functions.ts and schema_additions_oauth_identities.sql's own
// comment for why that matters).

import {
  Google,
  MicrosoftEntraId,
  decodeIdToken,
  generateState,
  generateCodeVerifier,
} from "arctic";
import {
  getSession,
  updateSession,
  clearSession,
} from "@tanstack/react-start/server";
import { withAdmin } from "@/lib/db.server";
import { createUserSession } from "@/lib/auth/session";

export type OAuthProvider = "google" | "microsoft";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is not configured -- sign-in via this provider is unavailable until it's set.`,
    );
  }
  return value;
}

function redirectUri(provider: OAuthProvider): string {
  const base = requireEnv("IRONIQ_BASE_URL").replace(/\/$/, "");
  return `${base}/api/auth/${provider}/callback`;
}

export function googleClient(): Google {
  return new Google(
    requireEnv("GOOGLE_CLIENT_ID"),
    requireEnv("GOOGLE_CLIENT_SECRET"),
    redirectUri("google"),
  );
}

export function microsoftClient(): MicrosoftEntraId {
  // "common" allows sign-in from any Microsoft 365 tenant, not just one
  // specific organization's Azure AD -- the right default for a
  // multi-tenant SaaS app whose customers each have their own M365
  // tenant, rather than assuming they're all in Ironclad's own tenant.
  const tenant = process.env["MICROSOFT_TENANT_ID"] || "common";
  return new MicrosoftEntraId(
    tenant,
    requireEnv("MICROSOFT_CLIENT_ID"),
    requireEnv("MICROSOFT_CLIENT_SECRET"),
    redirectUri("microsoft"),
  );
}

export function oauthConfigured(provider: OAuthProvider): boolean {
  if (provider === "google") {
    return Boolean(
      process.env["GOOGLE_CLIENT_ID"] && process.env["GOOGLE_CLIENT_SECRET"],
    );
  }
  return Boolean(
    process.env["MICROSOFT_CLIENT_ID"] &&
    process.env["MICROSOFT_CLIENT_SECRET"],
  );
}

interface IdTokenClaims {
  sub?: string;
  oid?: string;
  email?: string;
  preferred_username?: string;
  name?: string;
}

export interface OAuthIdentity {
  providerUserId: string;
  email: string;
  fullName: string | null;
}

/**
 * Extracts the stable subject id and email from an OIDC ID token.
 * Google uses `sub`; Microsoft Entra ID uses `oid` as the stable
 * per-tenant subject (its own `sub` claim is not guaranteed stable
 * across app registrations the way `oid` is) and often puts the sign-in
 * email in `preferred_username` rather than `email` for work/school
 * accounts.
 */
export function extractIdentity(
  provider: OAuthProvider,
  idToken: string,
): OAuthIdentity {
  const claims = decodeIdToken(idToken) as IdTokenClaims;
  const providerUserId = provider === "google" ? claims.sub : claims.oid;
  const email = claims.email ?? claims.preferred_username;
  if (!providerUserId || !email) {
    throw new Error(
      `${provider} sign-in did not return the expected account information.`,
    );
  }
  return {
    providerUserId,
    email: email.toLowerCase(),
    fullName: claims.name ?? null,
  };
}

export type SignInOutcome =
  { status: "signed_in"; userId: string } | { status: "pending_approval" };

/**
 * Finds or creates the app_users account for this OAuth identity, then
 * checks approval -- never creates a session itself (the caller does
 * that, exactly the way login() does for password auth, so both paths
 * converge on the same createUserSession call).
 *
 * Linking logic:
 *   1. An existing oauth_identities row for this (provider,
 *      providerUserId) -> that's the account, full stop.
 *   2. No existing link, but an app_users row already exists with this
 *      email (e.g. they signed up with a password first) -> link this
 *      OAuth identity to that existing account rather than creating a
 *      duplicate. Deliberate design choice: same real person, same
 *      account, whichever way they sign in.
 *   3. Neither -> create a brand-new app_users row exactly the way
 *      signup() does (no password_hash), which fires the very same
 *      handle_new_user() trigger and lands them in the very same
 *      unapproved, least-privileged, no-org-membership state a fresh
 *      password signup would.
 */
export async function findOrCreateOAuthUser(
  provider: OAuthProvider,
  identity: OAuthIdentity,
): Promise<SignInOutcome> {
  return withAdmin(async (client) => {
    const { rows: linked } = await client.query<{
      user_id: string;
      approved: boolean;
    }>(
      `SELECT oi.user_id, p.approved
         FROM public.oauth_identities oi
         JOIN public.profiles p ON p.id = oi.user_id
        WHERE oi.provider = $1 AND oi.provider_user_id = $2`,
      [provider, identity.providerUserId],
    );
    if (linked[0]) {
      return linked[0].approved
        ? { status: "signed_in" as const, userId: linked[0].user_id }
        : { status: "pending_approval" as const };
    }

    const { rows: existingByEmail } = await client.query<{
      id: string;
      approved: boolean;
    }>(
      `SELECT u.id, p.approved
         FROM public.app_users u
         JOIN public.profiles p ON p.id = u.id
        WHERE u.email = $1`,
      [identity.email],
    );

    let userId: string;
    let approved: boolean;
    if (existingByEmail[0]) {
      userId = existingByEmail[0].id;
      approved = existingByEmail[0].approved;
    } else {
      const { rows: created } = await client.query<{ id: string }>(
        `INSERT INTO public.app_users (email, password_hash, raw_user_meta_data)
         VALUES ($1, NULL, $2) RETURNING id`,
        [
          identity.email,
          JSON.stringify({ full_name: identity.fullName ?? null }),
        ],
      );
      userId = created[0].id;
      // handle_new_user()'s trigger just fired: approved defaults to
      // false for a brand-new account, same as password signup.
      approved = false;
    }

    await client.query(
      `INSERT INTO public.oauth_identities (user_id, provider, provider_user_id, email)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (provider, user_id) DO NOTHING`,
      [userId, provider, identity.providerUserId, identity.email],
    );

    return approved
      ? { status: "signed_in" as const, userId }
      : { status: "pending_approval" as const };
  });
}

interface HandshakeData {
  provider?: OAuthProvider;
  state?: string;
  codeVerifier?: string;
}

// A separate, short-lived, single-purpose cookie session -- not the same
// one auth/session.ts uses for a signed-in user. Only ever holds the
// state/codeVerifier pair for one in-flight OAuth round trip, cleared
// immediately after the callback consumes it (success or failure). A
// short maxAge specifically limits how long a captured/replayed
// authorization redirect could be used, on top of state/PKCE's own
// single-use protection.
function handshakeConfig() {
  const password = process.env.SESSION_SECRET;
  if (!password || password.length < 32) {
    throw new Error(
      "SESSION_SECRET must be set to a random string of at least 32 characters.",
    );
  }
  return {
    password,
    name: "ironiq_oauth_handshake",
    maxAge: 60 * 10, // 10 minutes -- plenty for a real sign-in, not for a stale replay
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const, // "lax" (not "strict") specifically because this cookie must survive the top-level redirect back from Google/Microsoft, a cross-site navigation
      path: "/",
    },
  };
}

export async function startHandshake(
  provider: OAuthProvider,
  state: string,
  codeVerifier: string,
): Promise<void> {
  await updateSession<HandshakeData>(handshakeConfig(), {
    provider,
    state,
    codeVerifier,
  });
}

/** Reads and immediately clears the handshake -- single use, whether the callback succeeds or fails. */
export async function consumeHandshake(): Promise<HandshakeData> {
  const session = await getSession<HandshakeData>(handshakeConfig());
  const data = { ...session.data };
  await clearSession(handshakeConfig());
  return data;
}

const SCOPES = ["openid", "email", "profile"];

function providerClient(provider: OAuthProvider): Google | MicrosoftEntraId {
  return provider === "google" ? googleClient() : microsoftClient();
}

function redirect(location: string): Response {
  return new Response(null, { status: 302, headers: { Location: location } });
}

/** GET /api/auth/{provider}/start -- redirects to the provider's real consent screen. */
export async function handleOAuthStart(
  provider: OAuthProvider,
): Promise<Response> {
  if (!oauthConfigured(provider)) {
    return new Response(
      `${provider} sign-in is not configured on this deployment.`,
      {
        status: 501,
      },
    );
  }
  let client: Google | MicrosoftEntraId;
  let url: URL;
  const state = generateState();
  const codeVerifier = generateCodeVerifier();
  try {
    client = providerClient(provider);
    url = client.createAuthorizationURL(state, codeVerifier, SCOPES);
  } catch (error) {
    console.error(error);
    return new Response(
      error instanceof Error ? error.message : "OAuth misconfigured",
      {
        status: 500,
      },
    );
  }
  await startHandshake(provider, state, codeVerifier);
  return redirect(url.toString());
}

/** GET /api/auth/{provider}/callback -- the provider redirects here after consent. */
export async function handleOAuthCallback(
  provider: OAuthProvider,
  request: Request,
): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const returnedState = url.searchParams.get("state");
  const handshake = await consumeHandshake();

  // Check for the provider's OWN error first, before any of the
  // state/CSRF checks below. Real gap found via a live test: if
  // Microsoft (or Google) redirects back with an error instead of a
  // code -- consent declined, admin approval required, the app
  // registration misconfigured in some way -- there's no `code` at all,
  // and the generic "missing code" branch below would have swallowed
  // that into the same undifferentiated "expired or already used"
  // message a genuine replayed/stale request gets. That conflates two
  // completely different problems into one unhelpful message. Surfacing
  // the provider's actual error text turns the next real attempt into a
  // definitive answer instead of another guess.
  const providerError = url.searchParams.get("error");
  if (providerError) {
    const description =
      url.searchParams.get("error_description") ?? providerError;
    console.error(
      `${provider} OAuth error: ${providerError} -- ${description}`,
    );
    return redirect(
      `/auth?oauth_error=oauth_failed&oauth_error_detail=${encodeURIComponent(description)}`,
    );
  }

  // Every one of these is a real, meaningful check, not defensive
  // boilerplate: a missing code/state means the provider redirected here
  // without actually completing consent (or someone hit this URL
  // directly, or the request is stale/replayed); a state mismatch is
  // exactly the CSRF this dance exists to prevent; a provider mismatch
  // means someone's Google callback somehow carried a Microsoft
  // handshake (shouldn't be reachable through the UI, but not assumed
  // impossible either).
  if (
    !code ||
    !returnedState ||
    !handshake.state ||
    !handshake.codeVerifier ||
    handshake.provider !== provider ||
    returnedState !== handshake.state
  ) {
    return redirect("/auth?oauth_error=invalid_state");
  }

  try {
    const client = providerClient(provider);
    const tokens = await client.validateAuthorizationCode(
      code,
      handshake.codeVerifier,
    );
    const identity = extractIdentity(provider, tokens.idToken());
    const outcome = await findOrCreateOAuthUser(provider, identity);

    if (outcome.status === "pending_approval") {
      return redirect("/auth?oauth_error=pending_approval");
    }

    await createUserSession(outcome.userId, request.headers.get("user-agent"));
    return redirect("/home");
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error(`${provider} OAuth callback failed:`, error);
    return redirect(
      `/auth?oauth_error=oauth_failed&oauth_error_detail=${encodeURIComponent(detail)}`,
    );
  }
}
