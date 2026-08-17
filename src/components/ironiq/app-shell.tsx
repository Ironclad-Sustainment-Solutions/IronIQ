import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Building2,
  Factory,
  ClipboardCheck,
  FileStack,
  AlertTriangle,
  TrendingUp,
  FileBarChart,
  Settings,
  Bell,
  ChevronDown,
  LogOut,
  PanelLeftClose,
  PanelLeft,
  Calculator,
  Cpu,
  Wrench,
  Gauge,
  Menu,
  ClipboardList,
  UploadCloud,
  FileImage,
  Sparkles,
  Code2,
  Compass,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { IronIQMark } from "@/components/ironiq/ironiq-mark";
import { logout } from "@/lib/auth/auth.functions";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { useApp } from "@/context/app-context";
import { ROLE_LABELS } from "@/lib/domain";
import { useNotifications } from "@/lib/api";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const OVERVIEW_ITEM = {
  to: "/dashboard",
  label: "Executive Dashboard",
  icon: LayoutDashboard,
};

// The three co-equal product pipelines — rendered with prominent styling,
// always at the top of the nav, visually distinct from every supporting
// section below. This is the actual fix for products reading as "blended
// in with everything else": size, weight, and position now signal these
// are THE three things this app does, not three more entries in one flat
// list of equal-looking sections.
const PRODUCT_NAV: {
  section: string;
  items: { to: string; label: string; icon: typeof LayoutDashboard }[];
}[] = [
  {
    // The only product with enough sub-pages to need a real accordion —
    // collapsed by default unless the current route is inside it. See
    // "Assessment Hub" note in assessment.tsx for why these are grouped
    // as one pipeline rather than split across sections.
    section: "Assessment",
    items: [
      { to: "/assessment", label: "Assessment Hub", icon: Compass },
      { to: "/intake", label: "Bulk Intake", icon: UploadCloud },
      { to: "/assessments", label: "Assessments", icon: ClipboardCheck },
      { to: "/capability", label: "Capability Assessment", icon: Gauge },
      { to: "/field", label: "Field Assessment", icon: ClipboardList },
      { to: "/findings", label: "Findings", icon: AlertTriangle },
      { to: "/projects", label: "Improvement Projects", icon: TrendingUp },
    ],
  },
  {
    // Single-item pipelines render as a direct link, not a dropdown with
    // nothing to expand into — same prominent tier as Assessment, just no
    // chevron since there's only one destination.
    section: "CAD Conversion",
    items: [{ to: "/cad", label: "CAD Conversion", icon: FileImage }],
  },
  {
    section: "CNC Coding",
    items: [{ to: "/cnc", label: "CNC Coding Enhancement", icon: Code2 }],
  },
];

// Everything that supports the three products but isn't one of them —
// compact, collapsed by default, one tier down visually from PRODUCT_NAV.
const SUPPORT_NAV: {
  section: string;
  items: { to: string; label: string; icon: typeof LayoutDashboard }[];
}[] = [
  {
    section: "Setup",
    items: [
      { to: "/organizations", label: "Organizations", icon: Building2 },
      { to: "/facilities", label: "Facilities", icon: Factory },
      { to: "/templates", label: "Assessment Templates", icon: FileStack },
    ],
  },
  {
    section: "Reporting",
    items: [{ to: "/reports", label: "Reports", icon: FileBarChart }],
  },
  {
    section: "Intelligence",
    items: [{ to: "/ask-ironiq", label: "Ask IronIQ", icon: Sparkles }],
  },
  {
    section: "Administration",
    items: [{ to: "/administration", label: "Administration", icon: Settings }],
  },
];

// Deliberately grouped together, de-emphasized: Manufacturing Estimating
// (RFQ/quoting) answers a question about Ironclad's own internal
// operations, same reasoning Executive Rollup was held back for — neither
// is one of the three customer-facing product pipelines or proven
// priority yet, so both live in the same quiet, collapsed-by-default
// section rather than competing visually with the real products above.
const LATER_NAV: {
  section: string;
  items: { to: string; label: string; icon: typeof LayoutDashboard }[];
}[] = [
  {
    section: "Coming Soon",
    items: [
      { to: "/executive-rollup", label: "Executive Rollup", icon: TrendingUp },
      { to: "/estimates", label: "Estimating", icon: Calculator },
      { to: "/production", label: "Production Flow", icon: Cpu },
      { to: "/production/libraries", label: "Machine & Tooling", icon: Wrench },
    ],
  },
];

const ALL_NAV_GROUPS = [...PRODUCT_NAV, ...SUPPORT_NAV, ...LATER_NAV];

function isItemActive(pathname: string, to: string): boolean {
  return pathname === to || pathname.startsWith(`${to}/`);
}

export function AppShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="flex min-h-screen w-full bg-background">
      <aside
        className={cn(
          "no-print sticky top-0 hidden h-screen shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200 md:flex",
          collapsed ? "w-16" : "w-64",
        )}
      >
        <div className="flex h-16 items-center gap-2.5 border-b border-sidebar-border px-4">
          <IronIQMark className="size-6 shrink-0" />
          {!collapsed && (
            <div className="min-w-0">
              <p className="font-display text-lg font-bold uppercase leading-none tracking-[0.18em] text-sidebar-foreground">
                Iron<span className="text-primary">IQ</span>
              </p>
              <p className="mt-0.5 truncate text-[10px] uppercase tracking-widest text-muted-foreground">
                Ironclad Sustainment
              </p>
            </div>
          )}
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
          <NavLinks collapsed={collapsed} pathname={pathname} />
        </nav>

        <div className="border-t border-sidebar-border p-2">
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            className="flex w-full items-center gap-3 rounded-sm px-3 py-2 text-sm text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
          >
            {collapsed ? (
              <PanelLeft className="size-4" aria-hidden />
            ) : (
              <PanelLeftClose className="size-4" aria-hidden />
            )}
            {!collapsed && <span>Collapse</span>}
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main className="flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}

function NavLinks({
  collapsed,
  pathname,
  onNavigate,
}: {
  collapsed?: boolean;
  pathname: string;
  onNavigate?: () => void;
}) {
  // Computed unconditionally, before any early return — hooks must run in
  // the same order every render, and collapsed genuinely toggles at
  // runtime via the sidebar's own collapse button, so this can't live
  // inside the icon-only branch below.
  const activeSection =
    ALL_NAV_GROUPS.find((g) =>
      g.items.some((item) => isItemActive(pathname, item.to)),
    )?.section ?? PRODUCT_NAV[0].section;
  const [expanded, setExpanded] = useState(activeSection);
  const toggle = (section: string) =>
    setExpanded((current) => (current === section ? "" : section));

  // Icon-only sidebar (desktop collapsed to w-16): accordion headers have
  // nowhere to put their label text anyway, so this keeps the original
  // flat-icon-list behavior exactly as it was — no behavior change for
  // this mode, only for the full-width expanded sidebar below.
  if (collapsed) {
    return (
      <>
        {[OVERVIEW_ITEM, ...ALL_NAV_GROUPS.flatMap((g) => g.items)].map(
          (item) => {
            const active = isItemActive(pathname, item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                title={item.label}
                onClick={onNavigate}
                className={cn(
                  "flex items-center gap-3 rounded-sm px-3 py-2.5 text-sm transition-colors",
                  active
                    ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground shadow-[inset_3px_0_0_0_var(--sidebar-primary)]"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                )}
              >
                <item.icon className="size-4 shrink-0" aria-hidden />
              </Link>
            );
          },
        )}
      </>
    );
  }

  return (
    <>
      <Link
        to={OVERVIEW_ITEM.to}
        title={OVERVIEW_ITEM.label}
        onClick={onNavigate}
        className={cn(
          "flex items-center gap-3 rounded-sm px-3 py-2.5 text-sm transition-colors",
          isItemActive(pathname, OVERVIEW_ITEM.to)
            ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground shadow-[inset_3px_0_0_0_var(--sidebar-primary)]"
            : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
        )}
      >
        <OVERVIEW_ITEM.icon className="size-4 shrink-0" aria-hidden />
        <span className="truncate">{OVERVIEW_ITEM.label}</span>
      </Link>

      <div className="my-3 border-t border-sidebar-border" />
      {PRODUCT_NAV.map((group) => (
        <NavSection
          key={group.section}
          group={group}
          pathname={pathname}
          isExpanded={expanded === group.section}
          onToggle={() => toggle(group.section)}
          onNavigate={onNavigate}
          tier="product"
        />
      ))}

      <div className="my-3 border-t border-sidebar-border" />
      {SUPPORT_NAV.map((group) => (
        <NavSection
          key={group.section}
          group={group}
          pathname={pathname}
          isExpanded={expanded === group.section}
          onToggle={() => toggle(group.section)}
          onNavigate={onNavigate}
          tier="support"
        />
      ))}

      <div className="my-3 border-t border-sidebar-border" />
      {LATER_NAV.map((group) => (
        <NavSection
          key={group.section}
          group={group}
          pathname={pathname}
          isExpanded={expanded === group.section}
          onToggle={() => toggle(group.section)}
          onNavigate={onNavigate}
          tier="later"
        />
      ))}
    </>
  );
}

function NavSection({
  group,
  pathname,
  isExpanded,
  onToggle,
  onNavigate,
  tier,
}: {
  group: {
    section: string;
    items: { to: string; label: string; icon: typeof LayoutDashboard }[];
  };
  pathname: string;
  isExpanded: boolean;
  onToggle: () => void;
  onNavigate?: () => void;
  tier: "product" | "support" | "later";
}) {
  const hasActive = group.items.some((item) => isItemActive(pathname, item.to));

  // A single-item group is a direct link, not a dropdown with nothing to
  // expand into — still styled at the same tier as its siblings so, e.g.,
  // CAD Conversion and CNC Coding read as visually equal to Assessment
  // even though only Assessment has a chevron.
  if (group.items.length === 1) {
    const item = group.items[0];
    const active = isItemActive(pathname, item.to);
    return (
      <Link
        to={item.to}
        title={group.section}
        onClick={onNavigate}
        className={cn(
          "mb-0.5 flex items-center gap-3 rounded-sm px-3 py-2.5 transition-colors",
          tier === "product"
            ? "text-sm font-bold uppercase tracking-wide"
            : "text-sm",
          tier === "later" && "opacity-70",
          active
            ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-[inset_3px_0_0_0_var(--sidebar-primary)]"
            : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
        )}
      >
        <item.icon className="size-4 shrink-0" aria-hidden />
        <span className="truncate">{group.section}</span>
      </Link>
    );
  }

  return (
    <div className="mb-0.5">
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-sm px-3 py-2.5 text-left transition-colors",
          tier === "product"
            ? "text-sm font-bold uppercase tracking-wide"
            : "text-[11px] font-semibold uppercase tracking-widest",
          tier === "later" && "opacity-70",
          hasActive
            ? "text-primary"
            : "text-sidebar-foreground/70 hover:text-sidebar-foreground",
        )}
      >
        <span className="truncate">{group.section}</span>
        <ChevronDown
          className={cn(
            "size-3.5 shrink-0 transition-transform",
            isExpanded && "rotate-180",
          )}
          aria-hidden
        />
      </button>
      {isExpanded ? (
        <div className="mt-0.5 space-y-0.5 border-l border-sidebar-border pl-2">
          {group.items.map((item) => {
            const active = isItemActive(pathname, item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                title={item.label}
                onClick={onNavigate}
                className={cn(
                  "flex items-center gap-3 rounded-sm px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground shadow-[inset_3px_0_0_0_var(--sidebar-primary)]"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                )}
              >
                <item.icon className="size-4 shrink-0" aria-hidden />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        className="-ml-1 rounded-sm p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground md:hidden"
        aria-label="Open navigation"
      >
        <Menu className="size-5" aria-hidden />
      </SheetTrigger>
      <SheetContent
        side="left"
        className="w-72 border-sidebar-border bg-sidebar p-0"
      >
        <SheetHeader className="flex h-16 flex-row items-center gap-2.5 border-b border-sidebar-border px-4">
          <IronIQMark className="size-6 shrink-0" />
          <SheetTitle className="font-display text-lg font-bold uppercase tracking-[0.18em] text-sidebar-foreground">
            Iron<span className="text-primary">IQ</span>
          </SheetTitle>
        </SheetHeader>
        <nav className="space-y-0.5 overflow-y-auto p-2">
          <NavLinks pathname={pathname} onNavigate={() => setOpen(false)} />
        </nav>
      </SheetContent>
    </Sheet>
  );
}

function TopBar() {
  const {
    organization,
    organizations,
    facility,
    facilities,
    setOrganizationId,
    setFacilityId,
    profile,
    primaryRole,
  } = useApp();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const notifications = useNotifications(facility?.id);

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await logout();
    navigate({ to: "/auth", replace: true });
  }

  const initials =
    (profile?.full_name ?? profile?.email ?? "?")
      .split(/[\s@.]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase())
      .join("") || "?";

  return (
    <header className="no-print sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-surface/95 px-4 backdrop-blur md:px-8">
      <MobileNav />
      <Link to="/dashboard" className="mr-1 flex items-center gap-2 md:hidden">
        <IronIQMark className="size-5" />
        <span className="font-display text-base font-bold uppercase tracking-widest">
          Iron<span className="text-primary">IQ</span>
        </span>
      </Link>

      <Selector
        label="Organization"
        value={organization?.name ?? "No organization"}
        options={organizations.map((o) => ({ id: o.id, label: o.name }))}
        onSelect={setOrganizationId}
      />
      <span className="hidden text-border sm:inline">/</span>
      <Selector
        label="Facility"
        value={facility?.name ?? "No facility"}
        options={facilities.map((f) => ({ id: f.id, label: f.name }))}
        onSelect={setFacilityId}
      />

      <div className="ml-auto flex items-center gap-1">
        <DropdownMenu>
          <DropdownMenuTrigger className="relative rounded-sm p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
            <Bell className="size-4" aria-hidden />
            <span className="sr-only">Notifications</span>
            <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-primary" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel>Notifications</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {notifications.isLoading ? (
              <DropdownMenuItem
                disabled
                className="text-xs text-muted-foreground"
              >
                Loading…
              </DropdownMenuItem>
            ) : null}
            {notifications.data &&
            notifications.data.criticalFindingsCount > 0 ? (
              <DropdownMenuItem
                asChild
                className="flex-col items-start gap-0.5 whitespace-normal"
              >
                <Link to="/findings">
                  <span className="text-sm text-critical">
                    {notifications.data.criticalFindingsCount} critical finding
                    {notifications.data.criticalFindingsCount === 1
                      ? ""
                      : "s"}{" "}
                    remain open
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {facility ? facility.name : "Across all facilities"} — not
                    yet closed or accepted as risk.
                  </span>
                </Link>
              </DropdownMenuItem>
            ) : null}
            {(notifications.data?.upcomingActions ?? []).map((a) => (
              <DropdownMenuItem
                key={a.id}
                asChild
                className="flex-col items-start gap-0.5 whitespace-normal"
              >
                <Link to="/findings">
                  <span className="text-sm">
                    Corrective action due{" "}
                    {new Date(a.target_date).toLocaleDateString()}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {a.action_description}
                  </span>
                </Link>
              </DropdownMenuItem>
            ))}
            {(notifications.data?.inProgressAssessments ?? []).map((a) => (
              <DropdownMenuItem
                key={a.id}
                asChild
                className="flex-col items-start gap-0.5 whitespace-normal"
              >
                <Link to="/assessments">
                  <span className="text-sm">Assessment in progress</span>
                  <span className="text-xs text-muted-foreground">
                    {a.name}
                  </span>
                </Link>
              </DropdownMenuItem>
            ))}
            {notifications.data &&
            notifications.data.criticalFindingsCount === 0 &&
            notifications.data.upcomingActions.length === 0 &&
            notifications.data.inProgressAssessments.length === 0 ? (
              <DropdownMenuItem
                disabled
                className="text-xs text-muted-foreground"
              >
                Nothing needs attention right now.
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 rounded-sm px-2 py-1.5 transition-colors hover:bg-accent">
            <span className="flex size-8 items-center justify-center rounded-sm bg-primary font-display text-xs font-bold text-primary-foreground">
              {initials}
            </span>
            <span className="hidden text-left lg:block">
              <span className="block text-xs font-medium leading-tight text-foreground">
                {profile?.full_name ?? profile?.email ?? "Account"}
              </span>
              <span className="block text-[10px] uppercase tracking-wider text-muted-foreground">
                {ROLE_LABELS[primaryRole]}
              </span>
            </span>
            <ChevronDown
              className="size-3.5 text-muted-foreground"
              aria-hidden
            />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuLabel className="flex flex-col gap-0.5">
              <span>{profile?.full_name ?? "Account"}</span>
              <span className="text-xs font-normal text-muted-foreground">
                {profile?.email}
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/administration">Profile &amp; administration</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => void signOut()}
              className="text-critical"
            >
              <LogOut className="size-4" aria-hidden />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

function Selector({
  label,
  value,
  options,
  onSelect,
}: {
  label: string;
  value: string;
  options: { id: string; label: string }[];
  onSelect: (id: string) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex min-w-0 max-w-[42vw] items-center gap-2 rounded-sm border border-border bg-background px-2.5 py-1.5 text-left transition-colors hover:border-primary/50 sm:max-w-64">
        <span className="min-w-0">
          <span className="block text-[10px] uppercase tracking-widest text-muted-foreground">
            {label}
          </span>
          <span className="block truncate text-xs font-medium text-foreground">
            {value}
          </span>
        </span>
        <ChevronDown
          className="ml-auto size-3.5 shrink-0 text-muted-foreground"
          aria-hidden
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuLabel>{label}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {options.length === 0 ? (
          <DropdownMenuItem disabled>None available</DropdownMenuItem>
        ) : (
          options.map((o) => (
            <DropdownMenuItem key={o.id} onSelect={() => onSelect(o.id)}>
              {o.label}
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
