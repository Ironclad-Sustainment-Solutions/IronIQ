import { Link, createFileRoute } from "@tanstack/react-router";
import {
  PageHeader,
  Panel,
  PrerequisiteGate,
} from "@/components/ironiq/layout-primitives";
import { Button } from "@/components/ui/button";
import { useApp } from "@/context/app-context";
import { useAssessmentHubStatus } from "@/lib/assessment-hub-status-api";

export const Route = createFileRoute("/_authenticated/assessment")({
  head: () => ({
    meta: [
      { title: "Assessment — IronIQ" },
      {
        name: "description",
        content:
          "Evaluate a machine shop's manufacturing readiness — find capability gaps, document findings backed by evidence, and track corrective work to closure.",
      },
      { property: "og:title", content: "Assessment — IronIQ" },
      {
        property: "og:description",
        content: "The Assessment product pipeline, start to finish.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AssessmentHubPage,
});

const ASSESSMENT_TYPES = [
  {
    to: "/assessments",
    label: "Assessments",
    statusKey: "template" as const,
    when: "Best for a consistent, repeatable evaluation against a standardized, published question set — scores roll up the same way across every facility you assess.",
  },
  {
    to: "/capability",
    label: "Capability Assessment",
    statusKey: "capability" as const,
    when: "Best when the real question is whether a capability actually performs well enough to support production, not just whether the equipment or process exists on paper.",
  },
  {
    to: "/field",
    label: "Field Assessment",
    statusKey: "field" as const,
    when: "Best for a fast, on-the-floor walkthrough — capturing observations, gaps, and photos as you move through the facility, not sitting down with a fixed form.",
  },
];

function AssessmentHubPage() {
  const { organization, organizations, facility, facilities } = useApp();
  const status = useAssessmentHubStatus(facility?.id);

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <PageHeader
        eyebrow="Assessments"
        title="Assessment Hub"
        description="Evaluate a machine shop's manufacturing readiness — find capability gaps, document findings backed by evidence, and track corrective work to closure. Three steps, in order."
      />

      <PrerequisiteGate
        requirements={[
          {
            label:
              "You need at least one organization before starting an assessment.",
            met: organizations.length > 0,
            ctaLabel: "Create an organization",
            ctaTo: "/organizations",
          },
          {
            label: `${organization?.name ?? "This organization"} has no facilities yet — an assessment needs one to scope against.`,
            met: facilities.length > 0,
            ctaLabel: "Add a facility",
            ctaTo: "/facilities",
          },
        ]}
      >
        <div className="space-y-8">
          <Panel
            title="1. Gather information"
            subtitle="Optional, but recommended before or during a client visit"
          >
            <p className="text-sm text-muted-foreground">
              Mass-upload evaluator notes, company documentation, or scanned
              process sheets. AI drafts suggested values for whichever
              assessment type you pick next — every value is reviewed before
              it's used.
            </p>
            <div className="mt-3">
              <Link to="/intake">
                <Button variant="outline">Go to Bulk Intake</Button>
              </Link>
            </div>
          </Panel>

          <Panel
            title="2. Choose your assessment type"
            subtitle="These are alternatives, not sequential steps — pick the one that fits"
          >
            <div className="grid gap-4 sm:grid-cols-3">
              {ASSESSMENT_TYPES.map((type) => {
                const s = status.data?.[type.statusKey];
                return (
                  <div
                    key={type.to}
                    className="flex flex-col justify-between rounded-md border border-border p-4"
                  >
                    <div>
                      <p className="font-display text-sm font-bold uppercase tracking-wide text-foreground">
                        {type.label}
                      </p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {type.when}
                      </p>
                      {facility ? (
                        <p className="mt-3 border-t border-border pt-2 text-xs font-medium text-foreground">
                          {status.isLoading ? (
                            "Loading…"
                          ) : s && "inProgress" in s ? (
                            s.total === 0 ? (
                              "None yet for this facility"
                            ) : (
                              <>
                                {s.inProgress > 0
                                  ? `${s.inProgress} in progress`
                                  : null}
                                {s.inProgress > 0 && s.finalized > 0
                                  ? " · "
                                  : null}
                                {s.finalized > 0
                                  ? `${s.finalized} finalized`
                                  : null}
                              </>
                            )
                          ) : s ? (
                            s.total === 0 ? (
                              "None yet for this facility"
                            ) : (
                              `${s.total} recorded`
                            )
                          ) : null}
                        </p>
                      ) : null}
                    </div>
                    <Link to={type.to} className="mt-4">
                      <Button size="sm" className="w-full">
                        Start
                      </Button>
                    </Link>
                  </div>
                );
              })}
            </div>
          </Panel>

          <Panel
            title="3. Findings & follow-up"
            subtitle="Every assessment type produces findings here"
          >
            <p className="text-sm text-muted-foreground">
              Findings from any assessment type land in one place. Close them
              out directly, or roll several into an Improvement Project tracked
              to measurable results.
            </p>
            <div className="mt-3 flex gap-2">
              <Link to="/findings">
                <Button variant="outline">Go to Findings</Button>
              </Link>
              <Link to="/projects">
                <Button variant="outline">Go to Improvement Projects</Button>
              </Link>
            </div>
          </Panel>
        </div>
      </PrerequisiteGate>
    </div>
  );
}
