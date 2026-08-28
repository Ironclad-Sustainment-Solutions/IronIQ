/**
 * Server-only: derives intelligence_events rows from each product's real
 * closure points — findings/corrective_actions/improvement_projects for
 * the Assessment product (Phase C), cnc_change_log for the CNC product
 * (Phase F). Split into its own .server.ts file for the same reason as
 * intake-shared.server.ts — these are plain functions that call withUser
 * directly, and mixing them into a file that also exports createServerFn
 * results breaks TanStack Start's client/server code splitting (see the
 * Phase 4 bug this project already hit once).
 *
 * Deliberately re-reads the source row from the database rather than
 * trusting client-supplied problem/resolution/outcome text — the entire
 * point is capturing exactly what's actually in the record, not a
 * possibly-different string the client happened to send. The client only
 * decides WHETHER to contribute (the consent checkbox at close-out time,
 * per Phase A); what gets captured is derived here, server-side, from the
 * row itself.
 */

import { withUser } from "@/lib/db.server";
import { generatePatternFromEvent } from "@/lib/intelligence-pattern-ai.server";

type IntelligenceProduct = "assessment" | "cad" | "cnc" | "machines";

async function insertEvent(
  userId: string,
  product: IntelligenceProduct,
  row: {
    organization_id: string;
    facility_id: string | null;
    source_table: string;
    source_id: string;
    problem_summary: string;
    resolution_summary: string | null;
    outcome_summary: string | null;
  },
): Promise<void> {
  if (!row.problem_summary?.trim()) return; // nothing meaningful to capture

  const { rows } = await withUser(userId, (client) =>
    client.query<{ id: string }>(
      `INSERT INTO public.intelligence_events
         (organization_id, facility_id, product, problem_summary, resolution_summary,
          outcome_summary, source_table, source_id, contribute_consent, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true,$9)
       RETURNING id`,
      [
        row.organization_id,
        row.facility_id,
        product,
        row.problem_summary,
        row.resolution_summary,
        row.outcome_summary,
        row.source_table,
        row.source_id,
        userId,
      ],
    ),
  );
  const eventId = rows[0].id;

  // Best-effort: draft the anonymized pattern right away. Never let an AI
  // failure here fail the close-out action the user actually asked for —
  // the raw event is already safely saved regardless of what happens next.
  try {
    const orgIndustry = await withUser(userId, async (client) => {
      const { rows: orgRows } = await client.query<{ industry: string | null }>(
        `SELECT industry FROM public.organizations WHERE id = $1`,
        [row.organization_id],
      );
      return orgRows[0]?.industry ?? null;
    });
    await generatePatternFromEvent({
      eventId,
      organizationIndustry: orgIndustry,
      problemSummary: row.problem_summary,
      resolutionSummary: row.resolution_summary,
      outcomeSummary: row.outcome_summary,
    });
  } catch (error) {
    // Swallowed deliberately — the event itself is saved either way, and
    // pattern generation can be retried later (e.g. from a review queue)
    // without needing to re-close the finding/action/project.
    console.error(
      "Pattern generation failed for intelligence_event",
      eventId,
      error,
    );
  }
}

/** Call after a finding's status has just been updated to 'closed' or 'accepted_risk'. */
export async function captureFromFinding(
  userId: string,
  findingId: string,
): Promise<void> {
  const row = await withUser(userId, async (client) => {
    const { rows } = await client.query(
      `SELECT organization_id, facility_id, description, root_cause, recommended_action, closure_evidence
         FROM public.findings WHERE id = $1`,
      [findingId],
    );
    return rows[0] as
      | {
          organization_id: string;
          facility_id: string;
          description: string;
          root_cause: string | null;
          recommended_action: string | null;
          closure_evidence: string | null;
        }
      | undefined;
  });
  if (!row) return;

  const problem_summary = row.root_cause
    ? `${row.description}\n\nRoot cause: ${row.root_cause}`
    : row.description;

  await insertEvent(userId, "assessment", {
    organization_id: row.organization_id,
    facility_id: row.facility_id,
    source_table: "findings",
    source_id: findingId,
    problem_summary,
    resolution_summary: row.recommended_action,
    outcome_summary: row.closure_evidence,
  });
}

/** Call after a corrective action's status has just been updated to 'closed'. */
export async function captureFromCorrectiveAction(
  userId: string,
  actionId: string,
): Promise<void> {
  const row = await withUser(userId, async (client) => {
    const { rows } = await client.query(
      `SELECT ca.facility_id, ca.action_description, ca.verification_notes,
              f.organization_id, f.description AS finding_description
         FROM public.corrective_actions ca
         JOIN public.findings f ON f.id = ca.finding_id
        WHERE ca.id = $1`,
      [actionId],
    );
    return rows[0] as
      | {
          facility_id: string;
          action_description: string;
          verification_notes: string | null;
          organization_id: string;
          finding_description: string;
        }
      | undefined;
  });
  if (!row) return;

  await insertEvent(userId, "assessment", {
    organization_id: row.organization_id,
    facility_id: row.facility_id,
    source_table: "corrective_actions",
    source_id: actionId,
    problem_summary: row.finding_description,
    resolution_summary: row.action_description,
    outcome_summary: row.verification_notes,
  });
}

/** Call after an improvement project's status has just been updated to 'complete'. */
export async function captureFromProject(
  userId: string,
  projectId: string,
): Promise<void> {
  const row = await withUser(userId, async (client) => {
    const { rows } = await client.query(
      `SELECT organization_id, facility_id, objective, baseline_metric, target_metric, actions, results
         FROM public.improvement_projects WHERE id = $1`,
      [projectId],
    );
    return rows[0] as
      | {
          organization_id: string;
          facility_id: string;
          objective: string | null;
          baseline_metric: string | null;
          target_metric: string | null;
          actions: string | null;
          results: string | null;
        }
      | undefined;
  });
  if (!row) return;

  const problem_summary = [
    row.objective,
    row.baseline_metric ? `Baseline: ${row.baseline_metric}` : null,
    row.target_metric ? `Target: ${row.target_metric}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  await insertEvent(userId, "assessment", {
    organization_id: row.organization_id,
    facility_id: row.facility_id,
    source_table: "improvement_projects",
    source_id: projectId,
    problem_summary,
    resolution_summary: row.actions,
    outcome_summary: row.results,
  });
}

/** Call after a CNC change log entry has just been marked 'verified'. */
export async function captureFromCncChangeLog(
  userId: string,
  entryId: string,
): Promise<void> {
  const row = await withUser(userId, async (client) => {
    const { rows } = await client.query(
      `SELECT organization_id, facility_id, machine_name, program_identifier, change_description,
              reason, outcome_description
         FROM public.cnc_change_log WHERE id = $1`,
      [entryId],
    );
    return rows[0] as
      | {
          organization_id: string;
          facility_id: string | null;
          machine_name: string;
          program_identifier: string | null;
          change_description: string;
          reason: string;
          outcome_description: string | null;
        }
      | undefined;
  });
  if (!row) return;

  const machineContext = row.program_identifier
    ? `${row.machine_name} (program ${row.program_identifier})`
    : row.machine_name;
  const problem_summary = `${row.reason}\n\nMachine: ${machineContext}`;

  await insertEvent(userId, "cnc", {
    organization_id: row.organization_id,
    facility_id: row.facility_id,
    source_table: "cnc_change_log",
    source_id: entryId,
    problem_summary,
    resolution_summary: row.change_description,
    outcome_summary: row.outcome_description,
  });
}

/**
 * Captures a pattern from a saved shop_machine_improvements change window
 * -- the Machines/IronIQ Edge analog of a closed finding or a CNC change
 * log entry: a real problem, a real change, a measurable outcome. Unlike
 * those two, the before/after numbers aren't stored directly on the row
 * -- they're computed from shop_machine_events the same way
 * getMachineImprovementComparison does, re-derived here rather than
 * trusting a client-supplied summary, matching every other capture
 * function in this file.
 */
export async function captureFromMachineImprovement(
  userId: string,
  improvementId: string,
): Promise<void> {
  const {
    eventQueryFromImprovement,
    computeImprovementBeforeAfter,
    formatHoursDelta,
    hoursToMakePart,
  } = await import("@/lib/machine-improvements");

  const row = await withUser(userId, async (client) => {
    const { rows } = await client.query(
      `SELECT i.*, p.part_number,
              m.asset_id AS machine_asset_id,
              CASE WHEN m.id IS NULL THEN NULL ELSE m.asset_id || ' — ' || m.name END AS machine_label
         FROM public.shop_machine_improvements i
         JOIN public.shop_parts p ON p.id = i.part_id
         JOIN public.shop_machines m ON m.id = i.machine_id
        WHERE i.id = $1`,
      [improvementId],
    );
    return rows[0] as
      | {
          organization_id: string;
          facility_id: string;
          title: string;
          machine_id: string;
          part_id: string;
          part_number: string | null;
          machine_asset_id: string | null;
          machine_label: string | null;
          changed_at: string;
          window_before_hours: string;
          window_after_hours: string;
        }
      | undefined;
  });
  if (!row) return;

  const change = {
    id: improvementId,
    organization_id: row.organization_id,
    facility_id: row.facility_id,
    plant_id: row.facility_id,
    part_id: row.part_id,
    machine_id: row.machine_id,
    title: row.title,
    changed_at: row.changed_at,
    window_before_hours: Number(row.window_before_hours),
    window_after_hours: Number(row.window_after_hours),
    created_at: row.changed_at,
    updated_at: row.changed_at,
    part_number: row.part_number,
    machine_asset_id: row.machine_asset_id,
    machine_label: row.machine_label,
    plant_name: null,
  };
  const query = eventQueryFromImprovement(change);
  if (!query) return; // no asset_id/part_number to match events against

  const beforeMs = change.window_before_hours * 60 * 60 * 1000;
  const afterMs = change.window_after_hours * 60 * 60 * 1000;
  const changedAt = new Date(change.changed_at);
  const windowStart = new Date(changedAt.getTime() - beforeMs);
  const windowEnd = new Date(changedAt.getTime() + afterMs);

  const events = await withUser(userId, async (client) => {
    try {
      const { rows } = await client.query(
        `SELECT ts_utc, machine_id, part_id, program_name, event_type,
                cycle_seq, cycle_time_s, idle_since_prev_cycle_s, gap_class
           FROM public.shop_machine_events
          WHERE machine_id = $1 AND part_id = $2
            AND organization_id = $3 AND facility_id = $4
            AND ts_utc >= $5 AND ts_utc < $6`,
        [
          query.machine_id,
          query.part_id,
          row.organization_id,
          row.facility_id,
          windowStart.toISOString(),
          windowEnd.toISOString(),
        ],
      );
      return rows as {
        ts_utc: string;
        machine_id: string;
        part_id: string | null;
        program_name: string | null;
        event_type: string;
        cycle_seq: number | null;
        cycle_time_s: number | null;
        idle_since_prev_cycle_s: number | null;
        gap_class: string | null;
      }[];
    } catch {
      return null; // table not present or query failed -- nothing to capture
    }
  });
  if (!events) return;

  const comparison = computeImprovementBeforeAfter(query, events);
  if (comparison.status !== "report") return;
  if (comparison.before.status !== "ok" || comparison.after.status !== "ok") {
    // Not enough real data on one side to say anything meaningful --
    // capturing "we don't know" as a precedent would be worse than not
    // capturing at all.
    return;
  }

  const machineContext =
    row.machine_label ?? row.machine_asset_id ?? "a shop-floor machine";
  const partContext = row.part_number ? ` making part ${row.part_number}` : "";
  const problem_summary = `${row.title}\n\nMachine: ${machineContext}${partContext}`;

  const cycleDelta = formatHoursDelta(
    hoursToMakePart(comparison.before.summary),
    hoursToMakePart(comparison.after.summary),
  );
  const resolution_summary = `Cycle time to make one part: ${cycleDelta}.`;

  await insertEvent(userId, "machines", {
    organization_id: row.organization_id,
    facility_id: row.facility_id,
    source_table: "shop_machine_improvements",
    source_id: improvementId,
    problem_summary,
    resolution_summary,
    outcome_summary: null,
  });
}
