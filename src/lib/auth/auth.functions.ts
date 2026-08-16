import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { withAdmin, withUser } from "@/lib/db.server";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import {
  createUserSession,
  destroySession,
  getSessionUserId,
} from "@/lib/auth/session";

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

    // Deliberately no session created here. New accounts start unapproved
    // and can't sign in until an admin approves them — see login() below.
    return { id: userId, email: data.email, pending: true as const };
  });

export const login = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => LoginInput.parse(input))
  .handler(async ({ data }) => {
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
      throw new Error("Invalid email or password.");
    }

    if (!user.approved) {
      throw new Error(
        "Your account is pending admin approval. You'll be notified once it's approved.",
      );
    }

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

    return withUser(userId, async (client) => {
      const [{ rows: profileRows }, { rows: roleRows }] = await Promise.all([
        client.query(
          "SELECT id, email, full_name, job_title, phone, status, approved, avatar_url FROM public.profiles WHERE id = $1",
          [userId],
        ),
        client.query("SELECT role FROM public.user_roles WHERE user_id = $1", [
          userId,
        ]),
      ]);
      const profile = profileRows[0] ?? null;
      return {
        id: userId,
        email: profile?.email ?? null,
        profile,
        roles: roleRows.map((r) => r.role as string),
      };
    });
  },
);
