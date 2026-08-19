/**
 * Split into its own .server.ts file for the same reason as
 * intake-shared.server.ts and intelligence-capture.server.ts — this is a
 * plain function that calls withUser directly, and mixing it into a file
 * that also exports createServerFn results (product-access.functions.ts)
 * breaks TanStack Start's client/server code splitting (the Phase 4 bug
 * this project already hit once).
 */

import { withUser } from "@/lib/db.server";

type Product = "assessment" | "cad" | "cnc";

/** Throws if the given product is restricted for the given organization. */
export async function assertProductAllowed(
  userId: string,
  organizationId: string,
  product: Product,
): Promise<void> {
  const restricted = await withUser(userId, async (client) => {
    const { rows } = await client.query(
      `SELECT 1 FROM public.organization_product_restrictions WHERE organization_id = $1 AND product = $2`,
      [organizationId, product],
    );
    return rows.length > 0;
  });
  if (restricted) {
    throw new Error(`This organization does not have access to ${product}.`);
  }
}

// The three helpers below close a gap found in a later review: createCadJob
// and createCncChangeLogEntry (the two "create new" entry points) were the
// only call sites checking assertProductAllowed. Every other CAD/CNC
// function -- list, extract, update, verify, delete -- operated on
// existing rows with no restriction check at all, so an org whose access
// was revoked after they'd already created records could still fully
// read/re-process/edit/delete every one of them indefinitely. These
// resolve the organization_id from the row itself (a lookup these
// functions weren't doing before) so the same restriction applies
// consistently across every action, not just creation.

/** Same as assertProductAllowed, but resolves the org from an existing CAD job's id first. */
export async function assertProductAllowedForCadJob(
  userId: string,
  jobId: string,
  product: Extract<Product, "cad">,
): Promise<void> {
  const organizationId = await withUser(userId, async (client) => {
    const { rows } = await client.query<{ organization_id: string }>(
      `SELECT organization_id FROM public.cad_jobs WHERE id = $1`,
      [jobId],
    );
    return rows[0]?.organization_id ?? null;
  });
  if (!organizationId) throw new Error("Job not found or not accessible.");
  await assertProductAllowed(userId, organizationId, product);
}

/** Same as assertProductAllowed, but resolves the org from an existing CAD extracted field's id first. */
export async function assertProductAllowedForCadField(
  userId: string,
  fieldId: string,
  product: Extract<Product, "cad">,
): Promise<void> {
  const organizationId = await withUser(userId, async (client) => {
    const { rows } = await client.query<{ organization_id: string }>(
      `SELECT cj.organization_id
         FROM public.cad_extracted_fields cf
         JOIN public.cad_jobs cj ON cj.id = cf.job_id
        WHERE cf.id = $1`,
      [fieldId],
    );
    return rows[0]?.organization_id ?? null;
  });
  if (!organizationId) throw new Error("Field not found or not accessible.");
  await assertProductAllowed(userId, organizationId, product);
}

/** Same as assertProductAllowed, but resolves the org from an existing standard assessment's id first. */
export async function assertProductAllowedForAssessment(
  userId: string,
  assessmentId: string,
  product: Extract<Product, "assessment">,
): Promise<void> {
  const organizationId = await withUser(userId, async (client) => {
    const { rows } = await client.query<{ organization_id: string }>(
      `SELECT organization_id FROM public.assessments WHERE id = $1`,
      [assessmentId],
    );
    return rows[0]?.organization_id ?? null;
  });
  if (!organizationId) throw new Error("Assessment not found or not accessible.");
  await assertProductAllowed(userId, organizationId, product);
}

/** Same as assertProductAllowed, but resolves the org from an existing capability assessment's id first. */
export async function assertProductAllowedForCapAssessment(
  userId: string,
  capAssessmentId: string,
  product: Extract<Product, "assessment">,
): Promise<void> {
  const organizationId = await withUser(userId, async (client) => {
    const { rows } = await client.query<{ organization_id: string }>(
      `SELECT organization_id FROM public.cap_assessments WHERE id = $1`,
      [capAssessmentId],
    );
    return rows[0]?.organization_id ?? null;
  });
  if (!organizationId) throw new Error("Assessment not found or not accessible.");
  await assertProductAllowed(userId, organizationId, product);
}

/** Same as assertProductAllowed, but resolves the org from an existing field assessment's id first. */
export async function assertProductAllowedForFieldAssessment(
  userId: string,
  fieldAssessmentId: string,
  product: Extract<Product, "assessment">,
): Promise<void> {
  const organizationId = await withUser(userId, async (client) => {
    const { rows } = await client.query<{ organization_id: string }>(
      `SELECT organization_id FROM public.field_assessments WHERE id = $1`,
      [fieldAssessmentId],
    );
    return rows[0]?.organization_id ?? null;
  });
  if (!organizationId) throw new Error("Assessment not found or not accessible.");
  await assertProductAllowed(userId, organizationId, product);
}

/** Same as assertProductAllowed, but resolves the org from an existing finding's id first (findings has organization_id directly). */
export async function assertProductAllowedForFinding(
  userId: string,
  findingId: string,
  product: Extract<Product, "assessment">,
): Promise<void> {
  const organizationId = await withUser(userId, async (client) => {
    const { rows } = await client.query<{ organization_id: string }>(
      `SELECT organization_id FROM public.findings WHERE id = $1`,
      [findingId],
    );
    return rows[0]?.organization_id ?? null;
  });
  if (!organizationId) throw new Error("Finding not found or not accessible.");
  await assertProductAllowed(userId, organizationId, product);
}

/** Same as assertProductAllowed, but resolves the org from an existing corrective action's id first (a join through its finding, since corrective_actions has no organization_id of its own). */
export async function assertProductAllowedForCorrectiveAction(
  userId: string,
  actionId: string,
  product: Extract<Product, "assessment">,
): Promise<void> {
  const organizationId = await withUser(userId, async (client) => {
    const { rows } = await client.query<{ organization_id: string }>(
      `SELECT f.organization_id
         FROM public.corrective_actions ca
         JOIN public.findings f ON f.id = ca.finding_id
        WHERE ca.id = $1`,
      [actionId],
    );
    return rows[0]?.organization_id ?? null;
  });
  if (!organizationId) throw new Error("Corrective action not found or not accessible.");
  await assertProductAllowed(userId, organizationId, product);
}

/** Same as assertProductAllowed, but resolves the org from an existing improvement project's id first (improvement_projects has organization_id directly). */
export async function assertProductAllowedForImprovementProject(
  userId: string,
  projectId: string,
  product: Extract<Product, "assessment">,
): Promise<void> {
  const organizationId = await withUser(userId, async (client) => {
    const { rows } = await client.query<{ organization_id: string }>(
      `SELECT organization_id FROM public.improvement_projects WHERE id = $1`,
      [projectId],
    );
    return rows[0]?.organization_id ?? null;
  });
  if (!organizationId) throw new Error("Improvement project not found or not accessible.");
  await assertProductAllowed(userId, organizationId, product);
}

/** Same as assertProductAllowed, but resolves the org from an existing CNC change log entry's id first. */
export async function assertProductAllowedForCncLogEntry(
  userId: string,
  entryId: string,
  product: Extract<Product, "cnc">,
): Promise<void> {
  const organizationId = await withUser(userId, async (client) => {
    const { rows } = await client.query<{ organization_id: string }>(
      `SELECT organization_id FROM public.cnc_change_log WHERE id = $1`,
      [entryId],
    );
    return rows[0]?.organization_id ?? null;
  });
  if (!organizationId) throw new Error("Entry not found or not accessible.");
  await assertProductAllowed(userId, organizationId, product);
}
