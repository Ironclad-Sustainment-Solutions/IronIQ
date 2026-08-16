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
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { IronIQMark } from "@/components/ironiq/ironiq-mark";
import { logout } from "@/lib/auth/auth.functions";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { useApp } from "@/context/app-context";
import { ROLE_LABELS } from "@/lib/domain";
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

const NAV: {
  section: string;
  items: { to: string; label: string; icon: typeof LayoutDashboard }[];
}[] = [
  {
    section: "Overview",
    items: [
      { to: "/dashboard", label: "Executive Dashboard", icon: LayoutDashboard },
    ],
  },
  {
    // Prerequisite for everything below: an assessment can't be scoped
    // without an organization and (for most systems) a facility. See
    // PrerequisiteGate in layout-primitives.tsx, which points back here.
    section: "Setup",
    items: [
      { to: "/organizations", label: "Organizations", icon: Building2 },
      { to: "/facilities", label: "Facilities", icon: Factory },
    ],
  },
  {
    // Ordered to match how an assessment actually happens: gather
    // documentation first (Bulk Intake), then pick which assessment type
    // to run. Assessment Templates lives here too, not under
    // Administration, since it's the thing Assessments directly consumes.
    section: "Assessment Workflow",
    items: [
      { to: "/intake", label: "Bulk Intake", icon: UploadCloud },
      { to: "/assessments", label: "Assessments", icon: ClipboardCheck },
      { to: "/capability", label: "Capability Assessment", icon: Gauge },
      { to: "/field", label: "Field Assessment", icon: ClipboardList },
      { to: "/templates", label: "Assessment Templates", icon: FileStack },
    ],
  },
  {
    section: "Findings & Improvement",
    items: [
      { to: "/findings", label: "Findings", icon: AlertTriangle },
      { to: "/projects", label: "Improvement Projects", icon: TrendingUp },
    ],
  },
  {
    section: "Reporting",
    items: [{ to: "/reports", label: "Reports", icon: FileBarChart }],
  },
  {
    // A genuinely separate capability from the facility-assessment
    // workflow above (RFQ/manufacturing-job estimating) — previously
    // interleaved into one flat list with no visual distinction from the
    // assessment tools, which was a real part of the "jumbled" feeling.
    section: "Manufacturing Estimating",
    items: [
      { to: "/estimates", label: "Estimating", icon: Calculator },
      { to: "/production", label: "Production Flow", icon: Cpu },
      { to: "/production/libraries", label: "Machine & Tooling", icon: Wrench },
    ],
  },
  {
    section: "Administration",
    items: [{ to: "/administration", label: "Administration", icon: Settings }],
  },
];

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
  return (
    <>
      {NAV.map((group, groupIndex) => (
        <div
          key={group.section}
          className={
            groupIndex > 0
              ? "mt-4 border-t border-sidebar-border pt-4"
              : undefined
          }
        >
          {!collapsed && (
            <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
              {group.section}
            </p>
          )}
          {group.items.map((item) => {
            const active =
              pathname === item.to || pathname.startsWith(`${item.to}/`);
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
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </div>
      ))}
    </>
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
            <DropdownMenuItem className="flex-col items-start gap-0.5 whitespace-normal">
              <span className="text-sm text-critical">
                2 critical findings remain open
              </span>
              <span className="text-xs text-muted-foreground">
                CNC program control and machine connectivity are gating
                production readiness.
              </span>
            </DropdownMenuItem>
            <DropdownMenuItem className="flex-col items-start gap-0.5 whitespace-normal">
              <span className="text-sm">Corrective action due 15 Sep 2026</span>
              <span className="text-xs text-muted-foreground">
                Ring-fence PM labor capacity — awaiting verification.
              </span>
            </DropdownMenuItem>
            <DropdownMenuItem className="flex-col items-start gap-0.5 whitespace-normal">
              <span className="text-sm">Follow-up assessment in progress</span>
              <span className="text-xs text-muted-foreground">
                Plant 4 Q3 Follow-Up — Engineering and Tooling complete.
              </span>
            </DropdownMenuItem>
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
