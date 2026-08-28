import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/auth-middleware";
import { withUser } from "@/lib/db.server";
import { loadPartCapture } from "@/lib/part-capture.server";

const GetPartCaptureInput = z.object({
  organizationId: z.string().uuid(),
  facilityId: z.string().uuid(),
  partId: z.string().min(1),
});

export const getPartCapture = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => GetPartCaptureInput.parse(d))
  .handler(async ({ data, context }) => {
    return withUser(context.userId, (client) =>
      loadPartCapture(client, {
        organizationId: data.organizationId,
        facilityId: data.facilityId,
        partId: data.partId.trim(),
      }),
    );
  });
