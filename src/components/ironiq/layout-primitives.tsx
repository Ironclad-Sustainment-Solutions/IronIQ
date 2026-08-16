import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 border-b border-border pb-6 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h1 className="mt-1 text-3xl font-semibold uppercase tracking-wide text-foreground md:text-4xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </header>
  );
}

export function Panel({
  title,
  subtitle,
  actions,
  children,
  className,
}: {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("panel flex flex-col", className)}>
      {(title || actions) && (
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div>
            {title ? (
              <h2 className="text-base font-semibold uppercase tracking-wider text-foreground">
                {title}
              </h2>
            ) : null}
            {subtitle ? (
              <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
            ) : null}
          </div>
          {actions}
        </div>
      )}
      <div className="flex-1 p-5">{children}</div>
    </section>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex min-h-32 items-center justify-center rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

export function DefinitionList({
  items,
}: {
  items: { label: string; value: ReactNode }[];
}) {
  return (
    <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <dt className="eyebrow">{item.label}</dt>
          <dd className="mt-1 text-sm text-foreground">{item.value ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * A single, consistent way to say "you need to do something else first" —
 * before this existed, three different pages that all have the same real
 * prerequisite (an organization, then a facility) each handled it
 * differently: assessments/new.tsx had no check at all (silently failed at
 * submit), capability/index.tsx had an ad-hoc inline sentence, field/index.tsx
 * just disabled a button with no explanation. Requirements are checked in
 * order and only the first unmet one is shown — the chain is meant to be
 * walked one step at a time (create an org, then a facility, then a
 * template, etc.), not all thrown at the user simultaneously.
 */
export function PrerequisiteGate({
  requirements,
  children,
}: {
  requirements: {
    label: string;
    met: boolean;
    ctaLabel: string;
    ctaTo: string;
  }[];
  children: ReactNode;
}) {
  const unmet = requirements.find((r) => !r.met);
  if (!unmet) return <>{children}</>;
  return (
    <div className="flex min-h-40 flex-col items-center justify-center gap-3 rounded-md border border-dashed border-border bg-muted/20 p-8 text-center">
      <p className="max-w-sm text-sm text-muted-foreground">{unmet.label}</p>
      <Link
        to={unmet.ctaTo}
        className="inline-flex items-center rounded-sm border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-primary transition-colors hover:bg-primary/20"
      >
        {unmet.ctaLabel}
      </Link>
    </div>
  );
}
