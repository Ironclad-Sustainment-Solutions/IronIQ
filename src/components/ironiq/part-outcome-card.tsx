import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DefinitionList } from "@/components/ironiq/layout-primitives";
import {
  beforeAfterDeltas,
  formatDelta,
  type PartOutcomeCard,
} from "@/lib/shop-floor";
import { formatDate } from "@/lib/utils";

export function PartOutcomeCardView({
  card,
  printable,
}: {
  card: PartOutcomeCard;
  printable?: boolean;
}) {
  const deltas = beforeAfterDeltas(card);
  return (
    <article className="part-outcome-card space-y-4 rounded-lg border border-border p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow">One-part before / after</p>
          <h2 className="mt-1 font-display text-2xl font-bold uppercase tracking-wide">
            {card.part_number}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {card.part_description || "No description"}
            {card.drawing_ref ? ` · drawing ${card.drawing_ref}` : ""}
          </p>
        </div>
        {printable ? (
          <Button
            variant="outline"
            className="no-print"
            onClick={() => window.print()}
          >
            <Printer className="size-4" aria-hidden />
            Print card
          </Button>
        ) : null}
      </header>
      <p className="text-sm text-foreground">{card.what_changed}</p>
      <DefinitionList
        items={[
          { label: "Machine", value: card.machine_label ?? "—" },
          {
            label: "Dates",
            value: `${formatDate(card.before_at)} → ${formatDate(card.after_at)}`,
          },
          {
            label: "Cycle time",
            value: `${card.cycle_time_sec_before} → ${card.cycle_time_sec_after} sec (${formatDelta(deltas.cycle_time_sec, "sec")})`,
          },
          {
            label: "Setup",
            value: `${card.setup_min_before} → ${card.setup_min_after} min (${formatDelta(deltas.setup_min, "min")})`,
          },
          {
            label: "Hours on part",
            value: `${card.hours_on_part_before} → ${card.hours_on_part_after} h (${formatDelta(deltas.hours_on_part, "h")})`,
          },
          {
            label: "Parts / shift",
            value:
              card.parts_per_shift_before == null &&
              card.parts_per_shift_after == null
                ? "—"
                : `${card.parts_per_shift_before ?? "—"} → ${card.parts_per_shift_after ?? "—"} (${formatDelta(deltas.parts_per_shift, "")})`,
          },
          {
            label: "Downtime",
            value:
              card.downtime_min_before == null &&
              card.downtime_min_after == null
                ? "—"
                : `${card.downtime_min_before ?? "—"} → ${card.downtime_min_after ?? "—"} min (${formatDelta(deltas.downtime_min, "min")})`,
          },
        ]}
      />
    </article>
  );
}
