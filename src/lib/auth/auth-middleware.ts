// Replaces src/integrations/supabase/auth-middleware.ts.
import { createMiddleware } from "@tanstack/react-start";
import { getSessionUserId } from "@/lib/auth/session";

export const requireAuth = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const userId = await getSessionUserId();
    if (!userId) {
      throw new Error("Unauthorized: no active session");
    }
    return next({ context: { userId } });
  },
);
