import { createFileRoute } from "@tanstack/react-router";
import { handleMachineEventsRequest } from "@/lib/machine-event-ingest.server";

export const Route = createFileRoute("/api/ironiq/v1/machine-events")({
  server: {
    handlers: {
      POST: async ({ request }) => handleMachineEventsRequest(request),
    },
  },
});
