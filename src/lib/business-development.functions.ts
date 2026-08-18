/**
 * Business Development — internal-only CRM for prospective customers.
 * Every function here is gated to platform staff (ironiq_admin,
 * consultant) via requirePlatformStaff, matching the RLS policies in
 * schema_additions_business_development.sql — belt and suspenders, same
 * reasoning already established elsewhere in this app (an explicit
 * check gives a clean error message instead of a silent "0 rows"
 * relying on RLS alone).
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/auth-middleware";
import { withUser } from "@/lib/db.server";

async function requirePlatformStaff(userId: string): Promise<void> {
  const isStaff = await withUser(userId, async (client) => {
    const { rows } = await client.query(
      "SELECT 1 FROM public.user_roles WHERE user_id = $1 AND role IN ('ironiq_admin', 'consultant')",
      [userId],
    );
    return rows.length > 0;
  });
  if (!isStaff) throw new Error("This requires IronIQ staff access.");
}

const PROSPECT_STAGES = [
  "lead",
  "qualifying",
  "proposal_sent",
  "negotiation",
  "won",
  "lost",
] as const;

export const fetchProspects = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    await requirePlatformStaff(context.userId);
    return withUser(context.userId, async (client) => {
      const { rows } = await client.query(
        `SELECT p.*,
                pr.full_name AS assigned_to_name,
                (SELECT count(*) FROM public.prospect_notes n WHERE n.prospect_id = p.id) AS note_count,
                (SELECT count(*) FROM public.prospect_meetings m WHERE m.prospect_id = p.id) AS interaction_count,
                (SELECT max(m.meeting_date) FROM public.prospect_meetings m WHERE m.prospect_id = p.id) AS last_interaction_at
           FROM public.prospects p
           LEFT JOIN public.profiles pr ON pr.id = p.assigned_to
          ORDER BY p.updated_at DESC`,
      );
      return rows;
    });
  });

// For the assignee picker — only platform staff can ever be assigned a
// lead, matching who this whole section is restricted to in the first
// place.
export const fetchStaffMembers = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    await requirePlatformStaff(context.userId);
    return withUser(context.userId, async (client) => {
      const { rows } = await client.query(
        `SELECT pr.id, pr.full_name, pr.email
           FROM public.profiles pr
           JOIN public.user_roles ur ON ur.user_id = pr.id
          WHERE ur.role IN ('ironiq_admin', 'consultant')
          ORDER BY pr.full_name NULLS LAST, pr.email`,
      );
      return rows;
    });
  });

const IdInput = z.object({ id: z.string().uuid() });

export const fetchProspectWorkspace = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => IdInput.parse(d))
  .handler(async ({ data, context }) => {
    await requirePlatformStaff(context.userId);
    return withUser(context.userId, async (client) => {
      const [prospect, contacts, notes, meetings] = await Promise.all([
        client.query(
          `SELECT p.*, pr.full_name AS assigned_to_name
             FROM public.prospects p
             LEFT JOIN public.profiles pr ON pr.id = p.assigned_to
            WHERE p.id = $1`,
          [data.id],
        ),
        client.query(
          "SELECT * FROM public.prospect_contacts WHERE prospect_id = $1 ORDER BY created_at",
          [data.id],
        ),
        client.query(
          "SELECT * FROM public.prospect_notes WHERE prospect_id = $1 ORDER BY created_at DESC",
          [data.id],
        ),
        client.query(
          "SELECT * FROM public.prospect_meetings WHERE prospect_id = $1 ORDER BY meeting_date DESC",
          [data.id],
        ),
      ]);
      return {
        prospect: prospect.rows[0] ?? null,
        contacts: contacts.rows,
        notes: notes.rows,
        meetings: meetings.rows,
      };
    });
  });

const SaveProspectInput = z.object({
  id: z.string().uuid().optional(),
  company_name: z.string().min(1),
  industry: z.string().nullable().optional(),
  stage: z.enum(PROSPECT_STAGES),
  estimated_value: z.number().nullable().optional(),
  expected_close_date: z.string().nullable().optional(),
  lost_reason: z.string().nullable().optional(),
  assigned_to: z.string().uuid().nullable().optional(),
});

export const saveProspect = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => SaveProspectInput.parse(d))
  .handler(async ({ data, context }) => {
    await requirePlatformStaff(context.userId);
    return withUser(context.userId, async (client) => {
      if (data.id) {
        const { rows } = await client.query(
          `UPDATE public.prospects
              SET company_name = $2, industry = $3, stage = $4, estimated_value = $5,
                  expected_close_date = $6, lost_reason = $7, assigned_to = $8, updated_at = now()
            WHERE id = $1
            RETURNING id`,
          [
            data.id,
            data.company_name,
            data.industry ?? null,
            data.stage,
            data.estimated_value ?? null,
            data.expected_close_date ?? null,
            data.lost_reason ?? null,
            data.assigned_to ?? null,
          ],
        );
        return rows[0].id as string;
      }
      const { rows } = await client.query(
        `INSERT INTO public.prospects
           (company_name, industry, stage, estimated_value, expected_close_date, lost_reason, assigned_to, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         RETURNING id`,
        [
          data.company_name,
          data.industry ?? null,
          data.stage,
          data.estimated_value ?? null,
          data.expected_close_date ?? null,
          data.lost_reason ?? null,
          data.assigned_to ?? null,
          context.userId,
        ],
      );
      return rows[0].id as string;
    });
  });

export const deleteProspect = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => IdInput.parse(d))
  .handler(async ({ data, context }) => {
    await requirePlatformStaff(context.userId);
    await withUser(context.userId, (client) =>
      client.query("DELETE FROM public.prospects WHERE id = $1", [data.id]),
    );
  });

// ---------------------------------------------------------------------
// Contacts
// ---------------------------------------------------------------------

const SaveContactInput = z.object({
  id: z.string().uuid().optional(),
  prospectId: z.string().uuid(),
  name: z.string().min(1),
  title: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export const saveContact = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => SaveContactInput.parse(d))
  .handler(async ({ data, context }) => {
    await requirePlatformStaff(context.userId);
    await withUser(context.userId, async (client) => {
      if (data.id) {
        await client.query(
          `UPDATE public.prospect_contacts SET name = $2, title = $3, email = $4, phone = $5, notes = $6 WHERE id = $1`,
          [
            data.id,
            data.name,
            data.title ?? null,
            data.email ?? null,
            data.phone ?? null,
            data.notes ?? null,
          ],
        );
        return;
      }
      await client.query(
        `INSERT INTO public.prospect_contacts (prospect_id, name, title, email, phone, notes)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [
          data.prospectId,
          data.name,
          data.title ?? null,
          data.email ?? null,
          data.phone ?? null,
          data.notes ?? null,
        ],
      );
    });
  });

export const deleteContact = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => IdInput.parse(d))
  .handler(async ({ data, context }) => {
    await requirePlatformStaff(context.userId);
    await withUser(context.userId, (client) =>
      client.query("DELETE FROM public.prospect_contacts WHERE id = $1", [
        data.id,
      ]),
    );
  });

// ---------------------------------------------------------------------
// Notes
// ---------------------------------------------------------------------

const SaveNoteInput = z.object({
  id: z.string().uuid().optional(),
  prospectId: z.string().uuid(),
  note: z.string().min(1),
});

export const saveNote = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => SaveNoteInput.parse(d))
  .handler(async ({ data, context }) => {
    await requirePlatformStaff(context.userId);
    await withUser(context.userId, async (client) => {
      if (data.id) {
        await client.query(
          "UPDATE public.prospect_notes SET note = $2 WHERE id = $1",
          [data.id, data.note],
        );
        return;
      }
      await client.query(
        "INSERT INTO public.prospect_notes (prospect_id, note, created_by) VALUES ($1,$2,$3)",
        [data.prospectId, data.note, context.userId],
      );
    });
  });

export const deleteNote = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => IdInput.parse(d))
  .handler(async ({ data, context }) => {
    await requirePlatformStaff(context.userId);
    await withUser(context.userId, (client) =>
      client.query("DELETE FROM public.prospect_notes WHERE id = $1", [
        data.id,
      ]),
    );
  });

// ---------------------------------------------------------------------
// Meetings
// ---------------------------------------------------------------------

const SaveMeetingInput = z.object({
  id: z.string().uuid().optional(),
  prospectId: z.string().uuid(),
  meeting_date: z.string(),
  interaction_type: z
    .enum(["meeting", "call", "email", "other"])
    .default("meeting"),
  attendees: z.string().nullable().optional(),
  summary: z.string().nullable().optional(),
  next_steps: z.string().nullable().optional(),
});

export const saveMeeting = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => SaveMeetingInput.parse(d))
  .handler(async ({ data, context }) => {
    await requirePlatformStaff(context.userId);
    await withUser(context.userId, async (client) => {
      if (data.id) {
        await client.query(
          `UPDATE public.prospect_meetings
              SET meeting_date = $2, interaction_type = $3, attendees = $4, summary = $5, next_steps = $6
            WHERE id = $1`,
          [
            data.id,
            data.meeting_date,
            data.interaction_type,
            data.attendees ?? null,
            data.summary ?? null,
            data.next_steps ?? null,
          ],
        );
        return;
      }
      await client.query(
        `INSERT INTO public.prospect_meetings
           (prospect_id, meeting_date, interaction_type, attendees, summary, next_steps, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [
          data.prospectId,
          data.meeting_date,
          data.interaction_type,
          data.attendees ?? null,
          data.summary ?? null,
          data.next_steps ?? null,
          context.userId,
        ],
      );
    });
  });

export const deleteMeeting = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => IdInput.parse(d))
  .handler(async ({ data, context }) => {
    await requirePlatformStaff(context.userId);
    await withUser(context.userId, (client) =>
      client.query("DELETE FROM public.prospect_meetings WHERE id = $1", [
        data.id,
      ]),
    );
  });
