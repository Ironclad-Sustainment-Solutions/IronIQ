import { createFileRoute } from "@tanstack/react-router";
import { handleEdgeConfigRequest } from "@/lib/edge-machine-config.server";

export const Route = createFileRoute("/api/ironiq/v1/edge-config")({
  server: {
    handlers: {
      GET: async ({ request }) => handleEdgeConfigRequest(request),
    },
  },
});
