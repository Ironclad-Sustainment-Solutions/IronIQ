import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  PageHeader,
  Panel,
  EmptyState,
} from "@/components/ironiq/layout-primitives";
import { Tag } from "@/components/ironiq/badges";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAskIronIQ } from "@/lib/ask-ironiq-api";

export const Route = createFileRoute("/_authenticated/ask-ironiq")({
  head: () => ({
    meta: [
      { title: "Ask IronIQ — IronIQ" },
      {
        name: "description",
        content:
          "Ask a question and get an answer grounded in anonymized precedent from resolved problems across engagements.",
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

function AskIronIQPage() {
  const [question, setQuestion] = useState("");
  const ask = useAskIronIQ();

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <PageHeader
        eyebrow="Intelligence Layer"
        title="Ask IronIQ"
        description="Answers are grounded only in anonymized, human-reviewed precedent from problems other engagements have actually resolved — this is precedent, not a guaranteed fix, and it's currently scoped to the Assessment product only."
      />

      <Panel title="Ask a question">
        <div className="space-y-3">
          <Textarea
            rows={3}
            placeholder="e.g. How have other shops resolved chatter on thin-wall aluminum parts at high spindle speed?"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
          />
          <Button
            onClick={() => ask.mutate(question)}
            disabled={ask.isPending || !question.trim()}
          >
            {ask.isPending ? "Searching precedent…" : "Ask"}
          </Button>
        </div>
      </Panel>

      {ask.data ? (
        <Panel title="Answer">
          <div className="space-y-4">
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
