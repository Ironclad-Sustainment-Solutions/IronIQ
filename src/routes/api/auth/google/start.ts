import { createFileRoute } from "@tanstack/react-router";
import { handleOAuthStart } from "@/lib/auth/oauth.server";

export const Route = createFileRoute("/api/auth/google/start")({
  server: {
    handlers: {
      GET: async () => handleOAuthStart("google"),
    },
  },
});
