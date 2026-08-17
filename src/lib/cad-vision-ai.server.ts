/**
 * Raster CAD path: extracts structured data (title block, dimensions,
 * tolerances, GD&T, notes) from a scanned/photographed drawing image
 * using Claude's vision input. This is deliberately scoped to data
 * extraction only — it does not attempt to reconstruct vector geometry
 * from the raster image, which isn't something current vision models do
 * reliably. The output is a data layer describing what's on the
 * drawing, reviewed field-by-field before anything is treated as real
 * (see cad.functions.ts's updateCadExtractedFieldStatus), same
 * discipline as every other AI-drafted content in this app.
 */

import { generateText, Output } from "ai";
import { z } from "zod";
import { createAnthropicProvider } from "@/lib/ai-gateway.server";

const MODEL = process.env["AI_MODEL"] ?? "claude-sonnet-5";

function gateway() {
  const key = process.env["ANTHROPIC_API_KEY"];
  if (!key) throw new Error("AI assistance is not configured.");
  return createAnthropicProvider(key);
}

const GUARDRAILS = `You are extracting data from a scanned or photographed mechanical/
manufacturing drawing. Rules:
- Extract ONLY what is actually legible on the drawing. Never guess a dimension, tolerance,
  or title-block value you cannot actually read — if a value is illegible or ambiguous, mark
  it low confidence and note the ambiguity in the value itself (e.g. "illegible — appears to
  be 2.5 or 2.8") rather than silently picking one.
- For each item, describe WHERE it is on the drawing in plain words (e.g. "title block,
  bottom-right", "diameter callout on the large hole, upper-left") — you cannot reliably
  provide exact pixel coordinates, so do not attempt to.
- Do not interpret what the part is FOR or infer anything about its use, cost, or
  manufacturing process — extraction only, not analysis.
- This is a draft for a human reviewer, not a finished record. Flag anything genuinely
  uncertain as low confidence rather than presenting a guess with false confidence.`;

const ExtractedFieldSchema = z.object({
  field_type: z.enum([
    "title_block",
    "dimension",
    "tolerance",
    "gdt",
    "note",
    "material",
    "other",
  ]),
  field_name: z.string(),
  field_value: z.string(),
  location_hint: z.string().nullable(),
  confidence: z.enum(["low", "moderate", "high"]),
});

export type ExtractedField = z.infer<typeof ExtractedFieldSchema>;

/**
 * imageBase64 should be the raw base64 content (no data: URL prefix) of a
 * single drawing image. mimeType e.g. "image/jpeg" or "image/png".
 */
export async function extractCadFields(
  imageBase64: string,
  mimeType: string,
): Promise<ExtractedField[]> {
  const result = await generateText({
    model: gateway()(MODEL),
    system: GUARDRAILS,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Extract every title-block field, dimension, tolerance, GD&T callout, material note, and general note visible on this drawing.",
          },
          { type: "image", image: imageBase64, mediaType: mimeType },
        ],
      },
    ],
    output: Output.object({
      schema: z.object({ fields: z.array(ExtractedFieldSchema) }),
    }),
  });

  const output = await result.output;
  return output.fields;
}
