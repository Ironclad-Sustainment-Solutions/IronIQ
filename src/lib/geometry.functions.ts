import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/auth-middleware";
import { withUser } from "@/lib/db.server";
import { getSignedDownloadUrl } from "@/lib/storage.server";

const submitSchema = z.object({
  rfqPartId: z.string().uuid(),
  rfqFileId: z.string().uuid(),
});

/**
 * submit-geometry-analysis
 *
 * Verifies the caller may see the RFQ part and file (RLS applies through the
 * authenticated client), mints a short-lived signed URL for the model, sends it
 * to the geometry provider, and records the request plus the structured result.
 * The provider credential never reaches the browser.
 */
export const submitGeometryAnalysis = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data: unknown) => submitSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const {
      runProviderAnalysis,
      featureRows,
      GEOMETRY_PROVIDER,
      GEOMETRY_PROVIDER_VERSION,
    } = await import("./geometry.server");

    return withUser(userId, async (client) => {
      const { rows: partRows } = await client.query(
        "SELECT id, organization_id, rfq_id FROM public.rfq_parts WHERE id = $1",
        [data.rfqPartId],
      );
      const part = partRows[0];
      if (!part) throw new Error("You do not have access to this RFQ part.");

      const { rows: fileRows } = await client.query(
        "SELECT id, bucket, storage_path, file_name, file_size, rfq_id FROM public.rfq_files WHERE id = $1",
        [data.rfqFileId],
      );
      const file = fileRows[0];
      if (!file || file.rfq_id !== part.rfq_id)
        throw new Error("That file does not belong to this RFQ.");

      const { rows: runRows } = await client.query(
        `INSERT INTO public.geometry_analysis_runs
           (rfq_part_id, rfq_file_id, organization_id, provider, provider_version, status, created_by)
         VALUES ($1,$2,$3,$4,$5,'running',$6) RETURNING id`,
        [
          part.id,
          file.id,
          part.organization_id,
          GEOMETRY_PROVIDER,
          GEOMETRY_PROVIDER_VERSION,
          userId,
        ],
      );
      const run = runRows[0];

      try {
        // A signed URL is what the real provider will consume. While the mock
        // provider is in place, a missing storage object must not block analysis.
        let signedUrl = "";
        try {
          signedUrl = await getSignedDownloadUrl(
            file.bucket,
            file.storage_path,
            300,
          );
        } catch {
          // storage not configured yet / object missing — mock provider tolerates this
        }

        const analysis = await runProviderAnalysis({
          signedUrl,
          fileName: file.file_name,
          fileSize: file.file_size,
          partId: part.id,
        });

        const manualReview =
          analysis.result.manual_review_flags.length > 0 ||
          analysis.uncertainty > 0.25;

        await client.query(
          `UPDATE public.geometry_analysis_runs
           SET status = 'complete', completed_at = now(), result = $1, warnings = $2,
               uncertainty = $3, manual_review_required = $4
           WHERE id = $5`,
          [
            JSON.stringify(analysis.result),
            JSON.stringify(analysis.warnings),
            analysis.uncertainty,
            manualReview,
            run.id,
          ],
        );

        const rows = featureRows(run.id, analysis.result);
        for (const row of rows as Record<string, unknown>[]) {
          const cols = Object.keys(row);
          const placeholders = cols.map((_, i) => `$${i + 1}`).join(", ");
          await client.query(
            `INSERT INTO public.manufacturing_features (${cols.join(", ")}) VALUES (${placeholders})`,
            cols.map((c) => row[c]),
          );
        }

        return {
          runId: run.id,
          result: analysis.result,
          warnings: analysis.warnings,
          uncertainty: analysis.uncertainty,
          manualReviewRequired: manualReview,
        };
      } catch (error) {
        await client.query(
          `UPDATE public.geometry_analysis_runs
           SET status = 'failed', completed_at = now(), manual_review_required = true, warnings = $1
           WHERE id = $2`,
          [
            JSON.stringify([
              error instanceof Error ? error.message : "Analysis failed.",
            ]),
            run.id,
          ],
        );
        throw error;
      }
    });
  });
