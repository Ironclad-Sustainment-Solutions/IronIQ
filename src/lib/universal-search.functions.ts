/**
 * Universal search: exact/fuzzy matching by name/ID across the app's
 * core entity types (machines, parts, findings, assessments, CAD jobs,
 * CNC log entries, organizations, facilities), plus a lightweight
 * heuristic for whether the query reads as a natural-language question
 * rather than an entity lookup -- the frontend uses that to also offer
 * "Ask IronIQ" instead of (or alongside) exact-match results.
 *
 * Every query goes through withUser (RLS-scoped), same as everywhere
 * else in this app -- a search result you can't otherwise see doesn't
 * exist as far as this endpoint is concerned. Deliberately does NOT
 * itself call the AI -- that's Ask IronIQ's job (and its own AI usage
 * rate limit); this endpoint only does fast, cheap SQL matching plus
 * the question heuristic, so a search-as-you-type UI can call it on
 * every keystroke without burning AI budget.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/auth-middleware";
import { withUser } from "@/lib/db.server";

export type SearchResultType =
  | "machine"
  | "part"
  | "finding"
  | "assessment"
  | "cad_job"
  | "cnc_entry"
  | "organization"
  | "facility";

export interface SearchResult {
  type: SearchResultType;
  id: string;
  label: string;
  sublabel: string | null;
  href: string;
}

const SearchInput = z.object({ query: z.string().min(1).max(200) });

const RESULTS_PER_TYPE = 5;

/**
 * A rough, deliberately generous heuristic for "this reads like a
 * question, not an entity lookup" -- multiple words plus either a
 * question mark or a leading question/wh-word. Errs toward showing the
 * Ask IronIQ option rather than hiding it; false positives just show an
 * extra option the user can ignore, false negatives hide a genuinely
 * useful path entirely.
 */
export function looksLikeNaturalLanguageQuestion(query: string): boolean {
  const trimmed = query.trim();
  if (trimmed.includes("?")) return true;
  const wordCount = trimmed.split(/\s+/).filter(Boolean).length;
  if (wordCount < 3) return false;
  return /^(what|why|how|when|which|who|is|are|does|do|can|should|will)\b/i.test(
    trimmed,
  );
}

export const universalSearch = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => SearchInput.parse(d))
  .handler(async ({ data, context }) => {
    const like = `%${data.query.replace(/[%_]/g, "\\$&")}%`;

    const results = await withUser(context.userId, async (client) => {
      const [
        machines,
        parts,
        findings,
        assessments,
        cadJobs,
        cncEntries,
        organizations,
        facilities,
      ] = await Promise.all([
        client.query(
          `SELECT id, asset_id, name FROM public.shop_machines
            WHERE asset_id ILIKE $1 OR name ILIKE $1
            ORDER BY asset_id LIMIT $2`,
          [like, RESULTS_PER_TYPE],
        ),
        client.query(
          `SELECT id, part_number FROM public.shop_parts
            WHERE part_number ILIKE $1
            ORDER BY part_number LIMIT $2`,
          [like, RESULTS_PER_TYPE],
        ),
        client.query(
          `SELECT id, finding_code, description, severity FROM public.findings
            WHERE description ILIKE $1 OR finding_code ILIKE $1
            ORDER BY created_at DESC LIMIT $2`,
          [like, RESULTS_PER_TYPE],
        ),
        client.query(
          `SELECT id, name FROM public.assessments
            WHERE name ILIKE $1
            ORDER BY assessment_date DESC LIMIT $2`,
          [like, RESULTS_PER_TYPE],
        ),
        client.query(
          `SELECT id, original_filename, status FROM public.cad_jobs
            WHERE original_filename ILIKE $1
            ORDER BY created_at DESC LIMIT $2`,
          [like, RESULTS_PER_TYPE],
        ),
        client.query(
          `SELECT id, machine_name, program_identifier FROM public.cnc_change_log
            WHERE machine_name ILIKE $1 OR program_identifier ILIKE $1
            ORDER BY created_at DESC LIMIT $2`,
          [like, RESULTS_PER_TYPE],
        ),
        client.query(
          `SELECT id, name FROM public.organizations
            WHERE name ILIKE $1
            ORDER BY name LIMIT $2`,
          [like, RESULTS_PER_TYPE],
        ),
        client.query(
          `SELECT id, name FROM public.facilities
            WHERE name ILIKE $1
            ORDER BY name LIMIT $2`,
          [like, RESULTS_PER_TYPE],
        ),
      ]);

      const out: SearchResult[] = [];
      for (const row of machines.rows) {
        out.push({
          type: "machine",
          id: String(row.asset_id),
          label: String(row.name),
          sublabel: String(row.asset_id),
          href: "/machines",
        });
      }
      for (const row of parts.rows) {
        out.push({
          type: "part",
          id: String(row.id),
          label: String(row.part_number),
          sublabel: null,
          href: "/machines/parts",
        });
      }
      for (const row of findings.rows) {
        out.push({
          type: "finding",
          id: String(row.id),
          label: String(row.description).slice(0, 80),
          sublabel: `${row.finding_code ?? "Finding"} · ${row.severity}`,
          href: "/findings",
        });
      }
      for (const row of assessments.rows) {
        out.push({
          type: "assessment",
          id: String(row.id),
          label: String(row.name),
          sublabel: null,
          href: `/assessments/${row.id}`,
        });
      }
      for (const row of cadJobs.rows) {
        out.push({
          type: "cad_job",
          id: String(row.id),
          label: String(row.original_filename),
          sublabel: String(row.status),
          href: "/cad",
        });
      }
      for (const row of cncEntries.rows) {
        out.push({
          type: "cnc_entry",
          id: String(row.id),
          label: String(row.machine_name),
          sublabel: row.program_identifier
            ? String(row.program_identifier)
            : null,
          href: "/cnc",
        });
      }
      for (const row of organizations.rows) {
        out.push({
          type: "organization",
          id: String(row.id),
          label: String(row.name),
          sublabel: null,
          href: "/organizations",
        });
      }
      for (const row of facilities.rows) {
        out.push({
          type: "facility",
          id: String(row.id),
          label: String(row.name),
          sublabel: null,
          href: "/facilities",
        });
      }
      return out;
    });

    return {
      results,
      looksLikeQuestion: looksLikeNaturalLanguageQuestion(data.query),
    };
  });
