/**
 * Live status for the Assessment Hub — the whole point is giving a
 * returning user a reason to revisit the hub, not just a first-time
 * onboarding page they click past once. Scoped to the selected facility,
 * matching every other facility-scoped query in this app.
 *
 * Template Assessments and Capability Assessments use real, well-defined
 * status enums, so those get a genuine in-progress/finalized breakdown.
 * Field Assessments' actual status column (assessment_status, added via
 * a later ALTER TABLE — the original `status` text column is vestigial
 * and not what the app writes to) is loose free text with at least one
 * non-obvious value in practice ("Converted to Full Assessment"), so
 * rather than guess at a bucketing I can't fully verify, that one just
 * gets a plain total count.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/auth-middleware";
import { withUser } from "@/lib/db.server";

const HubStatusInput = z.object({ facilityId: z.string().uuid() });

const IN_PROGRESS_STATUSES = [
  "draft",
  "intake",
  "in_progress",
  "review",
  "reopened",
];

export const getAssessmentHubStatus = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => HubStatusInput.parse(d))
  .handler(({ data, context }) =>
    withUser(context.userId, async (client) => {
      const template = await client.query(
        `SELECT status, count(*)::int AS count FROM public.assessments WHERE facility_id = $1 GROUP BY status`,
        [data.facilityId],
      );
      const capability = await client.query(
        `SELECT status, count(*)::int AS count FROM public.cap_assessments WHERE facility_id = $1 GROUP BY status`,
        [data.facilityId],
      );
      const field = await client.query(
        `SELECT count(*)::int AS count FROM public.field_assessments WHERE facility_id = $1`,
        [data.facilityId],
      );

      const summarize = (rows: { status: string; count: number }[]) => ({
        inProgress: rows
          .filter((r) => IN_PROGRESS_STATUSES.includes(r.status))
          .reduce((sum, r) => sum + r.count, 0),
        finalized: rows
          .filter((r) => r.status === "finalized")
          .reduce((sum, r) => sum + r.count, 0),
        total: rows.reduce((sum, r) => sum + r.count, 0),
      });

      return {
        template: summarize(template.rows),
        capability: summarize(capability.rows),
        field: { total: field.rows[0]?.count ?? 0 },
      };
    }),
  );
