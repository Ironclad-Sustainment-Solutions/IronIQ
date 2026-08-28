/**
 * Floor reads ingested iss.machine_event.v1 rows. This path does not poll
 * CNCs and does not insert events — ingest is a sibling PR.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/auth-middleware";
import { withUser } from "@/lib/db.server";
import {
  buildFloorView,
  parseFloorWindow,
  type FloorMachineIdentity,
  type FloorView,
} from "@/lib/machine-events";
import { listMachineEventsForFloor } from "@/lib/machine-events.server";

const ListFloorInput = z.object({
  organizationId: z.string().uuid(),
  facilityId: z.string().uuid(),
  windowStart: z.string().min(1),
  windowEnd: z.string().min(1),
});

export const listFloorView = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => ListFloorInput.parse(d))
  .handler(async ({ data, context }): Promise<FloorView> => {
    const window = parseFloorWindow(data.windowStart, data.windowEnd);

    return withUser(context.userId, async (client) => {
      const { rows } = await client.query(
        `SELECT id, asset_id, name, make, model, location
           FROM public.shop_machines
          WHERE organization_id = $1 AND facility_id = $2
          ORDER BY asset_id`,
        [data.organizationId, data.facilityId],
      );
      const machines: FloorMachineIdentity[] = rows.map((row) => ({
        id: String(row.id),
        asset_id: String(row.asset_id),
        name: String(row.name),
        make: String(row.make),
        model: String(row.model),
        location: row.location == null ? null : String(row.location),
      }));

      const { table, events } = await listMachineEventsForFloor(client, {
        organizationId: data.organizationId,
        facilityId: data.facilityId,
        assetIds: machines.map((m) => m.asset_id),
        windowStart: window.start,
        windowEnd: window.end,
      });

      return buildFloorView({
        machines,
        events,
        eventsAvailable: table != null,
        windowStart: window.start,
        windowEnd: window.end,
      });
    });
  });
