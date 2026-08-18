import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader, getRequestIP } from "@tanstack/react-start/server";
import { z } from "zod";
import { withAdmin, withUser } from "@/lib/db.server";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import {
  createUserSession,
  destroySession,
  getSessionUserId,
} from "@/lib/auth/session";
import {
  assertNotRateLimited,
  recordFailedAttempt,
  clearRateLimit,
  LOGIN_IP_LIMIT,
  LOGIN_EMAIL_LIMIT,
  SIGNUP_IP_LIMIT,
} from "@/lib/auth/rate-limit.server";

function clientIp(): string {
  // Render's edge sets X-Forwarded-For with the real client IP; the app is
  // only reachable through that proxy, so it can be trusted here. Falls
  // back to a fixed key rather than undefined so a misconfigured proxy
  // fails toward "one shared IP bucket" (still rate limited, just
  // coarsely) instead of toward "no rate limiting at all".
  return getRequestIP({ xForwardedFor: true }) ?? "unknown";
}

const SignupInput = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  fullName: z.string().optional(),
});

const LoginInput = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const signup = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => SignupInput.parse(input))
  .handler(async ({ data }) => {
    const ipKey = `signup:ip:${clientIp()}`;
    await assertNotRateLimited(ipKey);

    try {
      const passwordHash = await hashPassword(data.password);

      const userId = await withAdmin(async (client) => {
        const existing = await client.query(
          "SELECT id FROM public.app_users WHERE email = $1",
          [data.email],
        );
        if (existing.rows.length > 0) {
          throw new Error("An account with that email already exists.");
        }
        // Inserting here fires public.handle_new_user() — it creates the
        // profile (approved = false) and a least-privilege 'executive' role.
        // No organization membership is granted automatically; an admin
        // attaches the account to the right organization(s) after approving it.
        const { rows } = await client.query<{ id: string }>(
          `INSERT INTO public.app_users (email, password_hash, raw_user_meta_data)
           VALUES ($1, $2, $3) RETURNING id`,
          [
            data.email,
            passwordHash,
            JSON.stringify({ full_name: data.fullName ?? null }),
          ],
        );
        return rows[0].id;
      });

      // Deliberately no session created here. New accounts start
      // unapproved and can't sign in until an admin approves them — see
      // login() below.
      return { id: userId, email: data.email, pending: true as const };
    } finally {
      // Every signup attempt counts against the IP limit, success or
      // failure (including "account already exists") — this endpoint is
      // enumeration/spam surface, not a credential guess, so unlike login
      // there's no "only count failures" distinction. `finally` so a
      // thrown "already exists" error can't skip the count.
      await recordFailedAttempt(ipKey, SIGNUP_IP_LIMIT);
    }
  });

export const login = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => LoginInput.parse(input))
  .handler(async ({ data }) => {
    const normalizedEmail = data.email.trim().toLowerCase();
    const ipKey = `login:ip:${clientIp()}`;
    const emailKey = `login:email:${normalizedEmail}`;

    // Checked before touching the database or running bcrypt — a
    // locked-out caller shouldn't be able to use the expensive
    // verifyPassword path as a timing oracle or to burn CPU.
    await assertNotRateLimited(ipKey);
    await assertNotRateLimited(emailKey);

    const user = await withAdmin(async (client) => {
      const { rows } = await client.query<{
        id: string;
        password_hash: string;
        approved: boolean;
      }>(
        `SELECT u.id, u.password_hash, p.approved
           FROM public.app_users u
           JOIN public.profiles p ON p.id = u.id
          WHERE u.email = $1`,
        [data.email],
      );
      return rows[0] ?? null;
    });

    // Same generic error whether the email doesn't exist or the password is
    // wrong — don't leak which one it was.
    if (!user || !(await verifyPassword(data.password, user.password_hash))) {
      await Promise.all([
        recordFailedAttempt(ipKey, LOGIN_IP_LIMIT),
        recordFailedAttempt(emailKey, LOGIN_EMAIL_LIMIT),
      ]);
      throw new Error("Invalid email or password.");
    }

    if (!user.approved) {
      throw new Error(
        "Your account is pending admin approval. You'll be notified once it's approved.",
      );
    }

    // Successful, approved login — clear both counters so a legitimate
    // user who mistyped their password a few times isn't left partway
    // toward a lockout from attempts that are no longer relevant.
    await Promise.all([clearRateLimit(ipKey), clearRateLimit(emailKey)]);

    await createUserSession(user.id, getRequestHeader("user-agent"));
    return { id: user.id, email: data.email };
  });

export const logout = createServerFn({ method: "POST" }).handler(async () => {
  await destroySession();
  return { success: true };
});

/** Current logged-in user, or null. Safe to call from a loader/route guard. */
export const getCurrentUser = createServerFn({ method: "GET" }).handler(
  async () => {
    const userId = await getSessionUserId();
    if (!userId) return null;

    // This function's own docstring promises it's "safe to call from a
    // route guard" — but the database call below previously wasn't
    // actually wrapped in anything, so a transient failure here (which
    // runs before EVERY authenticated page load, no exceptions) would
    // crash the whole page render instead of the graceful degradation
    // the docstring implies. A failed auth check degrading to "treat as
    // logged out" (redirect to sign in) is a far better failure mode
    // than an opaque error page, and is honest — we genuinely couldn't
    // verify the session, so it's correct not to assume it's valid.
    try {
      return await withUser(userId, async (client) => {
        const [{ rows: profileRows }, { rows: roleRows }] = await Promise.all([
          client.query(
            "SELECT id, email, full_name, job_title, phone, status, approved, avatar_url FROM public.profiles WHERE id = $1",
            [userId],
          ),
          client.query(
            "SELECT role FROM public.user_roles WHERE user_id = $1",
            [userId],
          ),
        ]);
        const profile = profileRows[0] ?? null;
        return {
          id: userId,
          email: profile?.email ?? null,
          profile,
          roles: roleRows.map((r) => r.role as string),
        };
      });
    } catch (error) {
      console.error(
        "getCurrentUser: database error, treating as logged out",
        error,
      );
      return null;
    }
  },
);
