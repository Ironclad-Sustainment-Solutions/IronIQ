import { Link, createFileRoute } from "@tanstack/react-router";
import {
  Factory,
  Code2,
  FileImage,
  Sparkles,
  ArrowUpRight,
  ChevronDown,
} from "lucide-react";
import { Panel, EmptyState } from "@/components/ironiq/layout-primitives";
import { Tag } from "@/components/ironiq/badges";
import { useApp } from "@/context/app-context";
import { useNotifications } from "@/lib/api";
import { useScrollY, useRevealOnScroll } from "@/lib/scroll-effects";

export const Route = createFileRoute("/_authenticated/home")({
  head: () => ({
    meta: [
      { title: "Home — IronIQ" },
      {
        name: "description",
        content:
          "Shop-floor starting point — machines, the one-part CNC job, and drawing conversion.",
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
    to: "/machines",
    icon: Factory,
    label: "Machines",
    description:
      "Identify the 1–3 machines on this floor, then log cycles, runtime, idle, and downtime — by part — without a live machine connection.",
  },
  {
    to: "/cnc",
    icon: Code2,
    label: "One-part CNC job",
    description:
      "Log a change on a named machine, record structured before/after numbers, and print a one-page card for the part you're proving.",
  },
  {
    to: "/cad",
    icon: FileImage,
    label: "CAD Conversion",
    description:
      "Turn a scanned or photographed drawing into structured, searchable data — dimensions, tolerances, and title-block info, always reviewed by a person before it's trusted.",
  },
];

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/** Fades and slides a section up into place the first time it scrolls into view. */
function Reveal({
  children,
  delayMs = 0,
}: {
  children: React.ReactNode;
  delayMs?: number;
}) {
  const [ref, visible] = useRevealOnScroll<HTMLDivElement>();
  return (
    <div
      ref={ref}
      style={{ transitionDelay: visible ? `${delayMs}ms` : "0ms" }}
      className={`transition-all duration-700 ease-out ${
        visible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
      }`}
    >
      {children}
    </div>
  );
}

function HomePage() {
  const { profile, organization, facility } = useApp();
  const notifications = useNotifications(facility?.id);
  const firstName = profile?.full_name?.split(" ")[0];
  const scrollY = useScrollY();

  const hasAttentionItems =
    notifications.data &&
    (notifications.data.criticalFindingsCount > 0 ||
      notifications.data.upcomingActions.length > 0 ||
      notifications.data.inProgressAssessments.length > 0);

  return (
    <div className="space-y-10 pb-4">
      {/* Full-bleed hero — negative margins undo AppShell's <main> padding
          (px-4/py-6 on mobile, px-8/py-8 from md up) so this reaches the
          true edges rather than sitting inset inside the normal content
          column, without needing to change the shared layout itself. */}
      <div className="relative -mx-4 -mt-6 h-[420px] overflow-hidden md:-mx-8 md:-mt-8 md:h-[480px]">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: "url(/hero-machine-shop.webp)",
            // Parallax: background moves at a fraction of scroll speed,
            // clamped so it never drifts far enough to reveal an edge.
            transform: `translateY(${Math.min(scrollY * 0.25, 80)}px) scale(1.08)`,
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-background/20" />
        <div className="absolute inset-0 bg-gradient-to-r from-background/70 via-transparent to-transparent" />

        <div className="relative flex h-full max-w-3xl flex-col justify-end px-4 pb-10 md:px-8">
          <p className="eyebrow text-primary">
            {organization?.name ?? "IronIQ"}
          </p>
          <h1 className="mt-2 font-display text-4xl font-bold uppercase leading-[1.05] tracking-wide text-foreground md:text-5xl">
            {greeting()}
            {firstName ? `, ${firstName}` : ""}
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground md:text-base">
            Start with the machines on this floor and one named part.
            Assessments stay in the sidebar when you need them.
          </p>
        </div>

        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 animate-bounce text-muted-foreground/70">
          <ChevronDown className="size-5" aria-hidden />
        </div>
      </div>

      <div className="mx-auto max-w-5xl space-y-8">
        <Reveal>
          <div className="grid gap-4 sm:grid-cols-3">
            {PRODUCTS.map((product, i) => (
              <Reveal key={product.to} delayMs={i * 90}>
                <Link
                  to={product.to}
                  className="group flex h-full flex-col justify-between rounded-lg border border-border p-5 transition-colors hover:border-primary/50 hover:bg-muted/20"
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
              </Reveal>
            ))}
          </div>
        </Reveal>

        <Reveal>
          <Panel
            title="What needs attention"
            subtitle={
              facility ? facility.name : "Select a facility for details"
            }
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
                      {notifications.data.criticalFindingsCount} critical
                      finding
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
        </Reveal>

        <Reveal>
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
                  Search anonymized precedent from problems other engagements
                  have already resolved.
                </p>
              </div>
            </div>
            <ArrowUpRight
              className="size-5 text-muted-foreground"
              aria-hidden
            />
          </Link>
        </Reveal>
      </div>
    </div>
  );
}
