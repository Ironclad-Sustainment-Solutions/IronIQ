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

/**
 * An Edge agent install (generating the facility key, downloading the
 * binary, running it on shop-floor hardware) is carried out by
 * Ironclad's own staff as part of an on-site engagement, not something
 * a customer's own account does for themselves -- confirmed directly
 * against the real is_platform_staff() function (ironiq_admin,
 * consultant), the same check organizations' own RLS write policy
 * already uses, rather than inventing a second, parallel notion of
 * "staff."
 */
async function requirePlatformStaff(userId: string): Promise<void> {
  const isStaff = await withUser(userId, async (client) => {
    const { rows } = await client.query<{ is_staff: boolean }>(
      // private.is_platform_staff, not public -- confirmed against the
      // live database (and schema.sql's own
      // `ALTER FUNCTION public.is_platform_staff(uuid) SET SCHEMA private;`)
      // that this function was moved out of public at some point;
      // calling the stale public-schema name fails outright rather
      // than silently doing the wrong thing, which is how this was
      // caught before it ever shipped.
      "SELECT private.is_platform_staff($1) AS is_staff",
      [userId],
    );
    return rows[0]?.is_staff ?? false;
  });
  if (!isStaff) {
    throw new Error(
      "IronIQ Edge setup is managed by Ironclad's team as part of your engagement, not a self-serve customer action.",
    );
  }
}

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
      const { rows } = await client.query<{ organization_id: string }>(
        "SELECT organization_id FROM public.facilities WHERE id = $1",
        [data.facilityId],
      );
      return rows[0]?.organization_id ?? null;
    });
    if (!owned) throw new Error("Facility not found or not accessible.");
    // Real, server-side enforcement, not just a hidden UI element --
    // an Edge agent install is something Ironclad's own staff carry out
    // as part of an on-site engagement, not a self-serve customer
    // action. Checked here specifically because a client account could
    // otherwise call this server function directly (bypassing whatever
    // the UI shows or hides) and still generate a real, working key.
    await requirePlatformStaff(context.userId);
    const apiKey = await generateFacilityEdgeIngestKey(data.facilityId, owned);
    return { apiKey };
  });

export const getEdgeIngestKeyInfo = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => FacilityIdInput.parse(d))
  .handler(async ({ data, context }) => {
    await requirePlatformStaff(context.userId);
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
