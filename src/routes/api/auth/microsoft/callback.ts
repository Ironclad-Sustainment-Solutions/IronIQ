import { createFileRoute } from "@tanstack/react-router";
import { handleOAuthCallback } from "@/lib/auth/oauth.server";

export const Route = createFileRoute("/api/auth/microsoft/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => handleOAuthCallback("microsoft", request),
    },
  },
});
