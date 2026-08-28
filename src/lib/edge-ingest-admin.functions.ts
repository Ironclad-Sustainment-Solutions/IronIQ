/**
 * Session-authenticated (browser, logged-in user) actions for managing
 * an IronIQ Edge facility credential -- distinct from
 * machine-event-ingest.server.ts, which is the unauthenticated-by-session
 * HTTP endpoint the edge box itself posts to. A logged-in user generates
 * the key here; the edge box only ever presents it as a bearer token.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/auth-middleware";
import { withUser } from "@/lib/db.server";
import { generateFacilityEdgeIngestKey } from "@/lib/machine-event-ingest.server";

const FacilityIdInput = z.object({ facilityId: z.string().uuid() });

export const generateEdgeIngestKey = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => FacilityIdInput.parse(d))
  .handler(async ({ data, context }) => {
    // Confirm the caller actually has RLS-scoped access to this
    // facility before generating a key for it -- withUser here, not
    // withAdmin; generateFacilityEdgeIngestKey itself runs as withAdmin
    // internally (it has to, since the same underlying columns are also
    // read from the unauthenticated ingest path), but *deciding* to
    // generate a new key for a specific facility is a browser-session
    // action that must go through the normal authorization path first.
    const owned = await withUser(context.userId, async (client) => {
      const { rows } = await client.query(
        "SELECT 1 FROM public.facilities WHERE id = $1",
        [data.facilityId],
      );
      return rows.length > 0;
    });
    if (!owned) throw new Error("Facility not found or not accessible.");
    const apiKey = await generateFacilityEdgeIngestKey(data.facilityId);
    return { apiKey };
  });

export const getEdgeIngestKeyInfo = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => FacilityIdInput.parse(d))
  .handler(async ({ data, context }) => {
    return withUser(context.userId, async (client) => {
      const { rows } = await client.query<{
        edge_ingest_key_hint: string | null;
        edge_ingest_key_created_at: string | null;
      }>(
        `SELECT edge_ingest_key_hint, edge_ingest_key_created_at
           FROM public.facilities WHERE id = $1`,
        [data.facilityId],
      );
      const row = rows[0];
      if (!row) return null;
      return {
        hint: row.edge_ingest_key_hint,
        createdAt: row.edge_ingest_key_created_at,
      };
    });
  });
