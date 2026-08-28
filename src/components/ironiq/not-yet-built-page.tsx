import { EmptyState, PageHeader } from "@/components/ironiq/layout-primitives";

/**
 * Shared "not built yet" placeholder for sidebar-taxonomy items
 * (Suppliers, Tooling & Fixtures, Work Instructions, Quality,
 * Sustainment) that don't correspond to any existing feature. Rather
 * than a dead 404 or silently omitting them from the nav the taxonomy
 * calls for, this says so plainly -- matches the honesty standard used
 * elsewhere in this app (e.g. Ask IronIQ declining to fabricate an
 * answer it can't ground) rather than a page that looks finished but
 * has nothing behind it.
 */
export function NotYetBuiltPage({ title }: { title: string }) {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader eyebrow="Coming soon" title={title} />
      <EmptyState
        message={`${title} isn't built yet -- this is a placeholder in the nav, not a working page.`}
      />
    </div>
  );
}
