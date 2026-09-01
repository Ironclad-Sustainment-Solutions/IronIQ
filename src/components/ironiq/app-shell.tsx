import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  LayoutGrid,
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
  Menu,
  ClipboardList,
  UploadCloud,
  FileImage,
  Sparkles,
  Code2,
  Compass,
  Home,
  Handshake,
  Package,
  Users,
  Shield,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { IronIQMark } from "@/components/ironiq/ironiq-mark";
import { logout } from "@/lib/auth/auth.functions";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { useApp } from "@/context/app-context";
import {
  useProductRestrictions,
  type RestrictableProduct,
} from "@/lib/product-access-api";
import { ROLE_LABELS, type AppRole } from "@/lib/domain";
import { useNotifications } from "@/lib/api";
import { UniversalSearchDialog } from "@/components/ironiq/universal-search-dialog";
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

const HOME_ITEM = { to: "/home", label: "Home", icon: Home };

// Its own clearly separated tier, not lumped in with Reporting/
// Administration below — Setup is the prerequisite you do BEFORE using
// any product (an assessment can't be scoped without an organization and
// facility; see PrerequisiteGate in layout-primitives.tsx), which makes
// it a genuinely different kind of thing than "output you get from using
// the products" (Reporting) or "managing the app itself" (Administration).
interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  heading?: string;
  // Item-level now, not section-level: CAD & Drawings and CNC Programs
  // both live inside the same "Engineering" group as Technical Data and
  // Tooling & Fixtures, which aren't restrictable products themselves --
  // restricting "cad" must hide only the CAD & Drawings item, not the
  // whole Engineering section.
  restrictedProduct?: RestrictableProduct;
}

interface NavGroup {
  section: string;
  groupIcon?: typeof LayoutDashboard;
  items: NavItem[];
}

// Sidebar taxonomy: Capability / Engineering / Operations / Intelligence,
// replacing the earlier Machines/Assessments/CAD Conversion/CNC Coding
// product-pipeline structure. Every section renders at the same visual
// weight now -- no more "prominent product tier" vs "quieter support
// tier" distinction; that only made sense when there were 3-4 flagship
// products competing for attention against admin/setup sections. This
// taxonomy groups by function (what kind of work) instead, so a uniform
// treatment across all of them is the right call.
//
// Mapped existing routes onto the new labels where a real page already
// existed for the concept (Parts, Machines, CAD & Drawings, CNC
// Programs, Production, Capability Health = Dashboard, Risks = Findings,
// Insights = Ask IronIQ, Actions = Improvement Projects -- the last two
// confirmed directly). Processes maps to the existing Capability
// Assessment feature (process/criteria domains). Tooling & Fixtures maps
// to Production Libraries' existing tooling/materials/consumables data,
// not a new page -- moved off NotYetBuiltPage once that became clear.
// Sustainment is a real, purpose-built page combining human-reported
// Capability Assessment check-ins with real IronIQ Edge telemetry drift
// detection -- also not a NotYetBuiltPage stub.
//
// Three labels still have no existing page behind them at all
// (Suppliers, Work Instructions, Quality) -- route to NotYetBuiltPage
// rather than a dead link or silently disappearing from the layout, so
// the nav visually matches the target taxonomy without pretending
// something exists that doesn't.
//
// Two existing IronIQ Edge routes (Floor View, Improvements) don't have
// an obvious slot in this taxonomy at all -- rather than lose
// reachability of working features, they're kept as extra items under
// Operations alongside Production, which is the closest fit.
const CAPABILITY_NAV: NavGroup[] = [
  {
    section: "Capability",
    groupIcon: Package,
    items: [
      { to: "/machines/parts", label: "Parts", icon: Package },
      { to: "/machines", label: "Machines", icon: Factory },
      // The Assessment Hub, not /capability directly -- it's the actual
      // entry point linking onward to Assessments, Capability
      // Assessment, and Field Assessment. Mapping "Processes" to just
      // one of those three would strand the other two with no way back
      // in from this taxonomy at all.
      { to: "/assessment", label: "Processes", icon: Users },
      { to: "/suppliers", label: "Suppliers", icon: Building2 },
    ],
  },
];

const ENGINEERING_NAV: NavGroup[] = [
  {
    section: "Engineering",
    groupIcon: FileImage,
    items: [
      { to: "/intake", label: "Technical Data", icon: UploadCloud },
      {
        to: "/cad",
        label: "CAD & Drawings",
        icon: FileImage,
        restrictedProduct: "cad",
      },
      {
        to: "/cnc",
        label: "CNC Programs",
        icon: Code2,
        restrictedProduct: "cnc",
      },
      {
        to: "/production/libraries",
        label: "Tooling & Fixtures",
        icon: Wrench,
      },
    ],
  },
];

const OPERATIONS_NAV: NavGroup[] = [
  {
    section: "Operations",
    groupIcon: Cpu,
    items: [
      { to: "/production", label: "Production", icon: Cpu },
      { to: "/floor", label: "Floor View", icon: LayoutGrid },
      { to: "/machines/improvements", label: "Improvements", icon: TrendingUp },
      {
        to: "/work-instructions",
        label: "Work Instructions",
        icon: ClipboardList,
      },
      { to: "/quality", label: "Quality", icon: ClipboardCheck },
      { to: "/projects", label: "Actions", icon: Compass },
    ],
  },
];

const INTELLIGENCE_TAXONOMY_NAV: NavGroup[] = [
  {
    section: "Intelligence",
    groupIcon: Sparkles,
    items: [
      { to: "/dashboard", label: "Capability Health", icon: LayoutDashboard },
      { to: "/sustainment", label: "Sustainment", icon: Shield },
      {
        to: "/findings",
        label: "Risks",
        icon: AlertTriangle,
        restrictedProduct: "assessment",
      },
      { to: "/ask-ironiq", label: "Insights", icon: Sparkles },
    ],
  },
];

const BUSINESS_DEV_NAV: NavGroup[] = [
  {
    section: "Business",
    items: [
      {
        to: "/business-development",
        label: "Business Development",
        icon: Handshake,
      },
    ],
  },
];

const SETUP_NAV: NavGroup[] = [
  {
    section: "Setup",
    items: [
      { to: "/organizations", label: "Organizations", icon: Building2 },
      { to: "/facilities", label: "Facilities", icon: Factory },
      { to: "/templates", label: "Assessment Templates", icon: FileStack },
    ],
  },
];

// Ordered per direct feedback: Administration before Reporting.
const OTHER_NAV: NavGroup[] = [
  {
    section: "Administration",
    items: [{ to: "/administration", label: "Administration", icon: Settings }],
  },
  {
    section: "Reporting",
    items: [{ to: "/reports", label: "Reports", icon: FileBarChart }],
  },
];

// Deliberately grouped together, de-emphasized: Manufacturing Estimating
// (RFQ/quoting) and Executive Rollup answer questions about Ironclad's
// own internal operations, not proven priority yet. Production itself
// moved out of here into Operations (now a first-class item, not a
// placeholder) -- kept everything else in this list as before.
const LATER_NAV: NavGroup[] = [
  {
    section: "Coming Soon",
    items: [
      { to: "/executive-rollup", label: "Executive Rollup", icon: TrendingUp },
      { to: "/estimates", label: "Estimating", icon: Calculator },
      { to: "/production/libraries", label: "Machine & Tooling", icon: Wrench },
    ],
  },
];

const ALL_NAV_GROUPS = [
  ...CAPABILITY_NAV,
  ...ENGINEERING_NAV,
  ...OPERATIONS_NAV,
  ...INTELLIGENCE_TAXONOMY_NAV,
  ...BUSINESS_DEV_NAV,
  ...SETUP_NAV,
  ...OTHER_NAV,
  ...LATER_NAV,
];

function isItemActive(pathname: string, to: string): boolean {
  if (pathname === to) return true;
  if (!pathname.startsWith(`${to}/`)) return false;
  // `/machines` would otherwise also match `/machines/parts`.
  if (to === "/machines" && pathname.startsWith("/machines/parts")) {
    return false;
  }
  return true;
}

export function AppShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { organization, roles } = useApp();
  // Fetched once here, passed down to both NavLinks renders (desktop +
  // mobile sheet) rather than duplicating the query in each.
  const restrictedProducts =
    useProductRestrictions(organization?.id).data ?? [];

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
          <NavLinks
            collapsed={collapsed}
            pathname={pathname}
            restrictedProducts={restrictedProducts}
            roles={roles}
          />
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
  restrictedProducts = [],
  roles = [],
}: {
  collapsed?: boolean;
  pathname: string;
  onNavigate?: () => void;
  restrictedProducts?: RestrictableProduct[];
  roles?: AppRole[];
}) {
  const isPlatformStaff =
    roles.includes("ironiq_admin") || roles.includes("consultant");

  // Item-level filtering now, not section-level: CAD & Drawings and CNC
  // Programs live inside the same "Engineering" group as Technical Data
  // and Tooling & Fixtures (which aren't restrictable products
  // themselves), so restricting "cad" must hide only that one item, not
  // the whole group.
  const filterItems = (items: NavItem[]) =>
    items.filter(
      (item) =>
        !item.restrictedProduct ||
        !restrictedProducts.includes(item.restrictedProduct),
    );
  const visibleGroup = (group: NavGroup): NavGroup => ({
    ...group,
    items: filterItems(group.items),
  });

  const visibleCapabilityNav = CAPABILITY_NAV.map(visibleGroup);
  const visibleEngineeringNav = ENGINEERING_NAV.map(visibleGroup);
  const visibleOperationsNav = OPERATIONS_NAV.map(visibleGroup);
  const visibleIntelligenceNav = INTELLIGENCE_TAXONOMY_NAV.map(visibleGroup);

  const visibleAllGroups = [
    ...visibleCapabilityNav,
    ...visibleEngineeringNav,
    ...visibleOperationsNav,
    ...visibleIntelligenceNav,
    ...(isPlatformStaff ? BUSINESS_DEV_NAV : []),
    ...SETUP_NAV,
    ...OTHER_NAV,
    ...LATER_NAV,
  ];

  // Computed unconditionally, before any early return — hooks must run in
  // the same order every render, and collapsed genuinely toggles at
  // runtime via the sidebar's own collapse button, so this can't live
  // inside the icon-only branch below.
  // Falls back to "" (nothing expanded) rather than defaulting to
  // Assessment specifically — landing on a page that isn't part of any
  // nav group (like Home) shouldn't pre-open a product section that has
  // nothing to do with where the user actually is.
  const activeSection =
    visibleAllGroups.find((g) =>
      g.items.some((item) => isItemActive(pathname, item.to)),
    )?.section ?? "";
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
        {[HOME_ITEM, ...visibleAllGroups.flatMap((g) => g.items)].map(
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

  // Every section renders at the same uniform tier now (see the taxonomy
  // comment above CAPABILITY_NAV) -- no more bold "product" styling vs
  // quieter "support" styling; Capability/Engineering/Operations/
  // Intelligence/Business/Setup all read as equal-weight functional
  // groupings, matching the target sidebar design.
  const sectionGroups: { label: string; groups: NavGroup[] }[] = [
    { label: "Capability", groups: visibleCapabilityNav },
    { label: "Engineering", groups: visibleEngineeringNav },
    { label: "Operations", groups: visibleOperationsNav },
    { label: "Intelligence", groups: visibleIntelligenceNav },
    ...(isPlatformStaff
      ? [{ label: "Business", groups: BUSINESS_DEV_NAV }]
      : []),
    { label: "Setup", groups: SETUP_NAV },
  ];

  return (
    <>
      <Link
        to={HOME_ITEM.to}
        title={HOME_ITEM.label}
        onClick={onNavigate}
        className={cn(
          "flex items-center gap-3 rounded-sm px-3 py-2.5 text-sm transition-colors",
          isItemActive(pathname, HOME_ITEM.to)
            ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground shadow-[inset_3px_0_0_0_var(--sidebar-primary)]"
            : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
        )}
      >
        <HOME_ITEM.icon className="size-4 shrink-0" aria-hidden />
        <span className="truncate">{HOME_ITEM.label}</span>
      </Link>

      {sectionGroups.map(({ label, groups }) => (
        <div key={label}>
          <div className="my-3 border-t border-sidebar-border" />
          {groups.map((group) => (
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
        </div>
      ))}

      <div className="my-3 border-t border-sidebar-border" />
      {OTHER_NAV.map((group) => (
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
    groupIcon?: typeof LayoutDashboard;
    items: {
      to: string;
      label: string;
      icon: typeof LayoutDashboard;
      // Marks the start of a new logical sub-group within an expanded
      // dropdown — real segmentation for a section like Assessment
      // (8 items) rather than one undifferentiated flat list, without
      // needing a whole separate nested-group data model.
      heading?: string;
    }[];
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
        <span className="flex min-w-0 items-center gap-2">
          {group.groupIcon ? (
            <group.groupIcon className="size-4 shrink-0" aria-hidden />
          ) : null}
          <span className="truncate">{group.section}</span>
        </span>
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
              <div key={item.to}>
                {item.heading ? (
                  <p className="mb-0.5 mt-2 truncate px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 first:mt-0.5">
                    {item.heading}
                  </p>
                ) : null}
                <Link
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
              </div>
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
  const { organization, roles } = useApp();
  const restrictedProducts =
    useProductRestrictions(organization?.id).data ?? [];

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
          <NavLinks
            pathname={pathname}
            onNavigate={() => setOpen(false)}
            restrictedProducts={restrictedProducts}
            roles={roles}
          />
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
    navigate({
      to: "/auth",
      replace: true,
      search: { oauth_error: undefined, oauth_error_detail: undefined },
    });
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
      <Link to="/home" className="mr-1 flex items-center gap-2 md:hidden">
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
        <div className="hidden md:block">
          <UniversalSearchDialog />
        </div>
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
