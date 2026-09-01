import { createFileRoute } from "@tanstack/react-router";
import { handleOAuthCallback } from "@/lib/auth/oauth.server";

export const Route = createFileRoute("/api/auth/google/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => handleOAuthCallback("google", request),
    },
  },
});
