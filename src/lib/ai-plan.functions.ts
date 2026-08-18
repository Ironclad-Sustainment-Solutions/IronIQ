import { createServerFn } from "@tanstack/react-start";
import { requireAuth } from "@/lib/auth/auth-middleware";
import { withUser } from "@/lib/db.server";
import { checkAndRecordAiUsage } from "@/lib/auth/rate-limit.server";
import { z } from "zod";

const Input = z.object({ jobId: z.string().uuid() });

// Models frequently omit fields or send numbers as strings. Coerce + default
// everything so a slightly-off response still validates instead of throwing.
const num = (d = 0) => z.coerce.number().catch(d);
const str = (d = "") => z.coerce.string().catch(d);
const list = () => z.array(z.coerce.string()).catch([]);

const planSchema = z.object({
  summary: str(),
  complexity: z.enum(["low", "moderate", "high", "very_high"]).catch("moderate"),
  machining_strategy: str(),
  setups: z
    .array(
      z.object({
        setup_number: num(1),
        orientation: str(),
        workholding: str(),
        work_offset: str("G54"),
        rationale: str(),
        operations: z
          .array(
            z.object({
              sequence: num(1),
              operation_type: str(),
              feature: str(),
              description: str(),
              tool_number: num(1),
              tool_description: str(),
              holder: str(),
              spindle_rpm: num(),
              feed_rate: num(),
              step_down: num(),
              step_over: num(),
              stock_to_leave: num(),
              coolant: str(),
              entry_method: str(),
              exit_method: str(),
              tolerance: num(),
            }),
          )
          .catch([]),
      }),
    )
    .catch([]),
  risks: list(),
  assumptions: list(),
  data_gaps: list(),
  inspection_points: list(),
});

export type ManufacturingPlan = z.infer<typeof planSchema>;

const MODEL = process.env["AI_MODEL"] ?? "claude-sonnet-5";

export const generateManufacturingPlan = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data, context }) => {
    const apiKey = process.env["ANTHROPIC_API_KEY"];
    if (!apiKey) throw new Error("AI is not configured for this project.");

    const { userId } = context;
    await checkAndRecordAiUsage(userId);

    const plan = await withUser(userId, async (client) => {
      const { rows: jobRows } = await client.query("SELECT * FROM public.jobs WHERE id = $1", [
        data.jobId,
      ]);
      const job = jobRows[0];
      if (!job) throw new Error("Job not found or not accessible.");

      await client.query(
        "UPDATE public.jobs SET status = 'ai_manufacturing_plan_in_progress' WHERE id = $1",
        [job.id],
      );

      const { streamText, Output } = await import("ai");
      const { createAnthropicProvider } = await import("@/lib/ai-gateway.server");
      const gateway = createAnthropicProvider(apiKey);

      const prompt = `You are a senior CNC manufacturing planner preparing a PRELIMINARY manufacturing plan for programmer review. You never authorize production. Produce a complete, conservative plan.

JOB DATA
Part: ${job.part_number ?? "?"} ${job.part_name ?? ""} rev ${job.part_revision ?? "-"}
Quantity: ${job.quantity ?? "?"}
Material: ${job.material_spec ?? "unspecified"}
Stock: ${job.stock_type ?? "unspecified"} L${job.stock_length ?? "?"} W${job.stock_width ?? "?"} T${job.stock_thickness ?? "?"} D${job.stock_diameter ?? "?"}
Machine: ${job.machine_make ?? "?"} ${job.machine_model ?? ""}, controller ${job.controller ?? "?"}, ${job.axis_count ?? "?"} axis
Workholding: ${job.workholding_method ?? "unspecified"}
Fixture restrictions: ${job.fixture_restrictions ?? "none stated"}
Available tooling: ${job.available_tooling ?? "unspecified — assume common shop tooling and flag it"}
Critical dimensions: ${job.critical_dimensions ?? "none stated"}
GD&T: ${job.geometric_tolerances ?? "none stated"}
Surface finish: ${job.surface_finish_requirements ?? "none stated"}
Inspection: ${job.inspection_requirements ?? "none stated"}
Special instructions: ${job.special_instructions ?? "none"}

RULES
- Recommend setups, orientation, workholding, operation sequence, tooling, and conservative speeds/feeds for the stated material.
- Every value is a recommendation requiring programmer validation.
- List every assumption you made and every missing data item as a data gap.
- Keep the summary under 120 words. Limit to at most 4 setups and 10 operations per setup.`;

      const result = streamText({
        model: gateway(MODEL),
        prompt,
        output: Output.object({ schema: planSchema }),
      });

      let plan: ManufacturingPlan;
      try {
        plan = (await result.output) as ManufacturingPlan;
      } catch (planError) {
        // Fall back to parsing the raw model text before giving up.
        const raw =
          planError && typeof planError === "object" && "text" in planError
            ? String((planError as { text?: unknown }).text ?? "")
            : "";
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        const fallback = jsonMatch
          ? planSchema.safeParse(
              (() => {
                try {
                  return JSON.parse(jsonMatch[0]);
                } catch {
                  return null;
                }
              })(),
            )
          : null;

        if (fallback?.success) {
          plan = fallback.data;
        } else {
          const message = planError instanceof Error ? planError.message : "AI planning failed";
          await client.query(
            `INSERT INTO public.ai_plans (job_id, generated_by, model, plan, error)
             VALUES ($1, $2, $3, $4, $5)`,
            [job.id, userId, MODEL, JSON.stringify({}), message],
          );
          await client.query(
            "UPDATE public.jobs SET status = 'ready_for_ai_planning' WHERE id = $1",
            [job.id],
          );
          throw new Error(message);
        }
      }

      const { rows: insertedRows } = await client.query(
        `INSERT INTO public.ai_plans (job_id, generated_by, model, plan)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [job.id, userId, MODEL, JSON.stringify(plan)],
      );
      const planId = insertedRows[0].id;

      const operationRows = plan.setups.flatMap((setup) =>
        setup.operations.map((op) => ({
          job_id: job.id,
          setup_number: setup.setup_number,
          sequence: op.sequence,
          operation_type: op.operation_type,
          feature: op.feature,
          description: op.description,
          name: `${op.operation_type} — ${op.feature}`,
          tool_number: op.tool_number,
          tool_description: op.tool_description,
          holder: op.holder,
          spindle_rpm: op.spindle_rpm,
          feed_rate: op.feed_rate,
          step_down: op.step_down,
          step_over: op.step_over,
          stock_to_leave: op.stock_to_leave,
          coolant: op.coolant,
          entry_method: op.entry_method,
          exit_method: op.exit_method,
          tolerance: op.tolerance,
          work_offset: setup.work_offset,
          source: "ai_plan",
          validated: false,
        })),
      );

      await client.query(
        "DELETE FROM public.operations WHERE job_id = $1 AND source = 'ai_plan'",
        [job.id],
      );
      for (const op of operationRows) {
        const cols = Object.keys(op);
        const placeholders = cols.map((_, i) => `$${i + 1}`).join(", ");
        await client.query(
          `INSERT INTO public.operations (${cols.join(", ")}) VALUES (${placeholders})`,
          cols.map((c) => (op as Record<string, unknown>)[c]),
        );
      }

      await client.query(
        "UPDATE public.jobs SET status = 'ai_manufacturing_plan_generated' WHERE id = $1",
        [job.id],
      );

      await client.query(
        `INSERT INTO public.audit_logs (entity_type, entity_id, organization_id, actor_id, action, details)
         VALUES ('job', $1, $2, $3, $4, $5)`,
        [
          job.id,
          job.organization_id,
          userId,
          "AI manufacturing plan generated",
          JSON.stringify({
            detail: `${plan.setups.length} setup(s), ${operationRows.length} operation(s) — preliminary, programmer review required`,
          }),
        ],
      );

      return { planId, plan };
    });

    return plan;
  });
