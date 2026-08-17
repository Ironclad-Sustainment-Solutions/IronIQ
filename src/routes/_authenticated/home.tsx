import { Link, createFileRoute } from "@tanstack/react-router";
import {
  Compass,
  FileImage,
  Code2,
  Sparkles,
  ArrowUpRight,
} from "lucide-react";
import {
  PageHeader,
  Panel,
  EmptyState,
} from "@/components/ironiq/layout-primitives";
import { Tag } from "@/components/ironiq/badges";
import { Button } from "@/components/ui/button";
import { useApp } from "@/context/app-context";
import { useNotifications } from "@/lib/api";

export const Route = createFileRoute("/_authenticated/home")({
  head: () => ({
    meta: [
      { title: "Home — IronIQ" },
      {
        name: "description",
        content:
          "The starting point for IronIQ's three product pipelines — Assessment, CAD Conversion, and CNC Coding.",
      },
      { property: "og:title", content: "Home — IronIQ" },
      {
        property: "og:description",
        content: "Pick a pipeline, or catch up on what needs attention.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HomePage,
});

const PRODUCTS = [
  {
    to: "/assessment",
    icon: Compass,
    label: "Assessment",
    description:
      "Evaluate a machine shop's manufacturing readiness — find capability gaps, document findings backed by evidence, and track corrective work to closure.",
  },
  {
    to: "/cad",
    icon: FileImage,
    label: "CAD Conversion",
    description:
      "Turn a scanned or photographed drawing into structured, searchable data — dimensions, tolerances, and title-block info, always reviewed by a person before it's trusted.",
  },
  {
    to: "/cnc",
    icon: Code2,
    label: "CNC Coding",
    description:
      "Log program and machine changes as you make them, verify outcomes, and build a searchable history that helps solve the same problem faster next time.",
  },
];

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function HomePage() {
  const { profile, organization, facility } = useApp();
  const notifications = useNotifications(facility?.id);
  const firstName = profile?.full_name?.split(" ")[0];

  const hasAttentionItems =
    notifications.data &&
    (notifications.data.criticalFindingsCount > 0 ||
      notifications.data.upcomingActions.length > 0 ||
      notifications.data.inProgressAssessments.length > 0);

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <PageHeader
        eyebrow={organization?.name ?? "IronIQ"}
        title={`${greeting()}${firstName ? `, ${firstName}` : ""}`}
        description="Three product pipelines, one shared intelligence layer. Pick where you're headed."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        {PRODUCTS.map((product) => (
          <Link
            key={product.to}
            to={product.to}
            className="group flex flex-col justify-between rounded-lg border border-border p-5 transition-colors hover:border-primary/50 hover:bg-muted/20"
          >
            <div>
              <product.icon className="size-7 text-primary" aria-hidden />
              <p className="mt-3 font-display text-base font-bold uppercase tracking-wide text-foreground">
                {product.label}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {product.description}
              </p>
            </div>
            <div className="mt-4 flex items-center gap-1 text-sm font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
              Go <ArrowUpRight className="size-4" aria-hidden />
            </div>
          </Link>
        ))}
      </div>

      <Panel
        title="What needs attention"
        subtitle={facility ? facility.name : "Select a facility for details"}
      >
        {!facility ? (
          <EmptyState message="Select an organization and facility from the top bar to see what's active there." />
        ) : notifications.isLoading ? (
          <EmptyState message="Loading…" />
        ) : !hasAttentionItems ? (
          <EmptyState message="Nothing needs attention right now." />
        ) : (
          <div className="space-y-3">
            {notifications.data &&
            notifications.data.criticalFindingsCount > 0 ? (
              <Link
                to="/findings"
                className="flex items-center justify-between rounded-md border border-border p-3 transition-colors hover:bg-muted/20"
              >
                <span className="text-sm text-foreground">
                  {notifications.data.criticalFindingsCount} critical finding
                  {notifications.data.criticalFindingsCount === 1
                    ? ""
                    : "s"}{" "}
                  still open
                </span>
                <Tag token="critical">Findings</Tag>
              </Link>
            ) : null}
            {(notifications.data?.upcomingActions ?? []).map((a) => (
              <Link
                key={a.id}
                to="/findings"
                className="flex items-center justify-between rounded-md border border-border p-3 transition-colors hover:bg-muted/20"
              >
                <span className="text-sm text-foreground">
                  {a.action_description} — due{" "}
                  {new Date(a.target_date).toLocaleDateString()}
                </span>
                <Tag token="steel">Corrective action</Tag>
              </Link>
            ))}
            {(notifications.data?.inProgressAssessments ?? []).map((a) => (
              <Link
                key={a.id}
                to="/assessments"
                className="flex items-center justify-between rounded-md border border-border p-3 transition-colors hover:bg-muted/20"
              >
                <span className="text-sm text-foreground">{a.name}</span>
                <Tag token="primary">In progress</Tag>
              </Link>
            ))}
          </div>
        )}
      </Panel>

      <Link
        to="/ask-ironiq"
        className="flex items-center justify-between rounded-lg border border-border bg-muted/10 p-5 transition-colors hover:border-primary/50 hover:bg-muted/20"
      >
        <div className="flex items-center gap-3">
          <Sparkles className="size-6 text-primary" aria-hidden />
          <div>
            <p className="font-display text-sm font-bold uppercase tracking-wide text-foreground">
              Ask IronIQ
            </p>
            <p className="text-sm text-muted-foreground">
              Search anonymized precedent from problems other engagements have
              already resolved.
            </p>
          </div>
        </div>
        <ArrowUpRight className="size-5 text-muted-foreground" aria-hidden />
      </Link>
    </div>
  );
}
