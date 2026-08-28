import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Globe } from "lucide-react";
import {
  PageHeader,
  Panel,
  EmptyState,
} from "@/components/ironiq/layout-primitives";
import { Tag } from "@/components/ironiq/badges";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useApp } from "@/context/app-context";
import {
  useAskIronIQ,
  type IntelligenceProductFilter,
} from "@/lib/ask-ironiq-api";

export const Route = createFileRoute("/_authenticated/ask-ironiq")({
  head: () => ({
    meta: [
      { title: "Ask IronIQ — IronIQ" },
      {
        name: "description",
        content:
          "Ask a question and get an answer grounded in anonymized precedent from resolved problems across engagements and products.",
      },
      { property: "og:title", content: "Ask IronIQ — IronIQ" },
      {
        property: "og:description",
        content: "Query the shared Intelligence Layer.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AskIronIQPage,
});

const PRODUCT_LABELS: Record<IntelligenceProductFilter, string> = {
  assessment: "Assessments",
  cad: "CAD Conversion",
  cnc: "CNC Coding",
  machines: "Machines",
};

const PRODUCT_TAG_TOKEN: Record<
  IntelligenceProductFilter,
  "primary" | "steel" | "success" | "medium"
> = {
  assessment: "primary",
  cad: "steel",
  cnc: "success",
  machines: "medium",
};

const ALL_PRODUCTS: IntelligenceProductFilter[] = [
  "assessment",
  "cad",
  "cnc",
  "machines",
];

function AskIronIQPage() {
  const { organization, facility } = useApp();
  const [question, setQuestion] = useState("");
  const [selectedProducts, setSelectedProducts] =
    useState<IntelligenceProductFilter[]>(ALL_PRODUCTS);
  const ask = useAskIronIQ();

  const toggleProduct = (p: IntelligenceProductFilter) => {
    setSelectedProducts((current) =>
      current.includes(p) ? current.filter((x) => x !== p) : [...current, p],
    );
  };

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <PageHeader
        eyebrow="Intelligence Layer"
        title="Ask IronIQ"
        description="Answers are grounded only in anonymized, human-reviewed precedent from problems other engagements have actually resolved — this is precedent, not a guaranteed fix. Searches across every product that has approved patterns."
      />

      <Panel title="Ask a question">
        <div className="space-y-3">
          <Textarea
            rows={3}
            placeholder="e.g. How have other shops resolved chatter on thin-wall aluminum parts at high spindle speed?"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
          />
          <div className="flex flex-wrap items-center gap-4">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Search in:
            </span>
            {ALL_PRODUCTS.map((p) => (
              <div key={p} className="flex items-center gap-1.5">
                <Checkbox
                  id={`product-${p}`}
                  checked={selectedProducts.includes(p)}
                  onCheckedChange={() => toggleProduct(p)}
                />
                <Label htmlFor={`product-${p}`} className="text-sm font-normal">
                  {PRODUCT_LABELS[p]}
                </Label>
              </div>
            ))}
          </div>
          <Button
            onClick={() =>
              ask.mutate({
                question,
                products: selectedProducts,
                organizationId: organization?.id,
                facilityId: facility?.id,
              })
            }
            disabled={
              ask.isPending || !question.trim() || selectedProducts.length === 0
            }
          >
            {ask.isPending ? "Searching precedent…" : "Ask"}
          </Button>
        </div>
      </Panel>

      {ask.data ? (
        <Panel title="Answer">
          <div className="space-y-4">
            {ask.data.noMatchingPrecedent && !ask.data.usedExternalKnowledge ? (
              <div className="rounded-md border border-border bg-muted/20 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-foreground">
                  No matching precedent
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  IronIQ has no reviewed cycle/runtime history for this
                  question. This is not generic model knowledge presented as
                  IronIQ data.
                </p>
              </div>
            ) : null}
            {ask.data.usedExternalKnowledge ? (
              <div className="flex items-start gap-2 rounded-md border border-primary/40 bg-primary/10 p-3">
                <Globe
                  className="mt-0.5 size-4 shrink-0 text-primary"
                  aria-hidden
                />
                <p className="text-xs text-foreground">
                  <span className="font-semibold uppercase tracking-wide text-primary">
                    Using external knowledge —{" "}
                  </span>
                  no matching precedent was found in IronIQ's own reviewed
                  engagement history. This answer comes from Claude's general
                  knowledge instead, not from anything this app's clients have
                  actually done.
                </p>
              </div>
            ) : null}
            {ask.data.usedLiveFloorSnapshot ? (
              <div className="flex items-start gap-2 rounded-md border border-medium/40 bg-medium/10 p-3">
                <p className="text-xs text-foreground">
                  <span className="font-semibold uppercase tracking-wide text-medium">
                    Live shop-floor data —{" "}
                  </span>
                  no historical precedent matched, so this answer is grounded in
                  your own organization's current machine states and recent
                  cycle data instead — not a general pattern, and not another
                  engagement's history.
                </p>
              </div>
            ) : null}
            <p className="whitespace-pre-wrap text-sm text-foreground">
              {ask.data.answer}
            </p>

            {ask.data.patterns.length > 0 ? (
              <div className="border-t border-border pt-4">
                <p className="eyebrow mb-3">
                  Based on {ask.data.patterns.length} pattern
                  {ask.data.patterns.length === 1 ? "" : "s"} from other
                  engagements
                </p>
                <ul className="space-y-3">
                  {ask.data.patterns.map((p, i) => (
                    <li
                      key={p.id}
                      className="rounded-md border border-border p-3 text-sm"
                    >
                      <div className="mb-1.5 flex items-center gap-2">
                        <span className="metric text-xs text-muted-foreground">
                          Pattern {i + 1}
                        </span>
                        <Tag token={PRODUCT_TAG_TOKEN[p.product]}>
                          {PRODUCT_LABELS[p.product]}
                        </Tag>
                        <Tag token="steel">
                          {p.category_label ?? "unspecified industry"}
                        </Tag>
                      </div>
                      <p className="text-foreground">{p.pattern_summary}</p>
                      {p.pattern_resolution ? (
                        <p className="mt-1 text-muted-foreground">
                          Resolution: {p.pattern_resolution}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </Panel>
      ) : ask.isPending ? null : (
        <EmptyState message="Ask a question above to search the Intelligence Layer." />
      )}
    </div>
  );
}
