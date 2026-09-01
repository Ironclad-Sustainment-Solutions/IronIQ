/**
 * IronIQ Edge already ingests alarm events (shop_machine_events.event_type
 * = 'alarm') but nothing downstream surfaced them as a quality/risk
 * signal -- they just sat in the events table. This closes that real,
 * previously-flagged gap.
 *
 * Deliberately NOT automatic: every alarm event does not become a
 * finding by itself. A CNC alarm can be a genuine quality/safety issue,
 * or it can be a routine door-open/E-stop-reset/tool-change blip that
 * happens dozens of times a shift -- auto-creating a finding for every
 * one would flood Findings with noise and make the real ones harder to
 * see, exactly the failure mode the rest of this app's "human review
 * before it counts" pattern (pattern capture, sustainment check-ins)
 * already avoids elsewhere. Instead: surface unreviewed alarms as
 * candidates, let a person decide which are actually worth tracking.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/auth-middleware";
import { withUser } from "@/lib/db.server";
import {
  isMissingMachineEventRelation,
  resolveMachineEventTable,
} from "@/lib/machine-events.server";

export interface UnreviewedAlarm {
  event_id: string;
  machine_asset_id: string;
  machine_name: string;
  alarm_code: string | null;
  ts_utc: string;
  program_name: string | null;
}

const FacilityInput = z.object({ facilityId: z.string().uuid() });

export const listUnreviewedAlarms = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => FacilityInput.parse(d))
  .handler(async ({ data, context }) => {
    return withUser(context.userId, async (client) => {
      const table = await resolveMachineEventTable(client);
      if (!table) return [];
      try {
        const { rows } = await client.query<{
          event_id: string;
          machine_asset_id: string;
          machine_name: string;
          alarm_code: string | null;
          ts_utc: string;
          program_name: string | null;
        }>(
          `SELECT e.id AS event_id, m.asset_id AS machine_asset_id, m.name AS machine_name,
                  e.alarm_code, e.ts_utc, e.program_name
             FROM public.${table} e
             JOIN public.shop_machines m ON m.id = e.shop_machine_id
             LEFT JOIN public.findings f ON f.source_machine_event_id = e.id
            WHERE e.facility_id = $1
              AND e.event_type = 'alarm'
              AND e.alarm_active = true
              AND f.id IS NULL
            ORDER BY e.ts_utc DESC
            LIMIT 25`,
          [data.facilityId],
        );
        return rows;
      } catch (error) {
        // Same defensive pattern used everywhere else this table is
        // queried -- a customer without Edge/alarm data configured yet
        // gets an empty list, not a broken page.
        if (isMissingMachineEventRelation(error)) return [];
        throw error;
      }
    });
  });

const CreateFromAlarmInput = z.object({ eventId: z.string().uuid() });

export const createFindingFromAlarm = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => CreateFromAlarmInput.parse(d))
  .handler(async ({ data, context }) => {
    return withUser(context.userId, async (client) => {
      const table = await resolveMachineEventTable(client);
      if (!table) throw new Error("Machine event data is not available.");

      const { rows: eventRows } = await client.query<{
        organization_id: string;
        facility_id: string;
        machine_asset_id: string;
        machine_name: string;
        alarm_code: string | null;
        ts_utc: string;
        program_name: string | null;
      }>(
        `SELECT e.organization_id, e.facility_id, m.asset_id AS machine_asset_id,
                m.name AS machine_name, e.alarm_code, e.ts_utc, e.program_name
           FROM public.${table} e
           JOIN public.shop_machines m ON m.id = e.shop_machine_id
          WHERE e.id = $1 AND e.event_type = 'alarm'`,
        [data.eventId],
      );
      const event = eventRows[0];
      if (!event) throw new Error("Alarm event not found or not accessible.");

      const { rows: codeRows } = await client.query<{ code: string }>(
        "SELECT public.next_finding_code() AS code",
      );

      const description = `Machine alarm on ${event.machine_name} (${event.machine_asset_id})${
        event.alarm_code ? `: ${event.alarm_code}` : ""
      }, reported by IronIQ Edge at ${new Date(event.ts_utc).toLocaleString()}${
        event.program_name ? ` while running program ${event.program_name}` : ""
      }.`;

      const { rows } = await client.query<{ id: string }>(
        `INSERT INTO public.findings
           (finding_code, organization_id, facility_id, category_name, severity,
            status, description, source_machine_event_id, created_by)
         VALUES ($1,$2,$3,'Machine Alarm','medium','open',$4,$5,$6)
         RETURNING id`,
        [
          codeRows[0]?.code ?? null,
          event.organization_id,
          event.facility_id,
          description,
          data.eventId,
          context.userId,
        ],
      );
      return { id: rows[0].id };
    });
  });
