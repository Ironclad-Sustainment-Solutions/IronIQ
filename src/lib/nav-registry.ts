/**
 * Every page someone might want to jump to directly by name, kept as
 * plain data specifically so it can be searched (universal-search.functions.ts)
 * without needing a database round trip -- page existence isn't
 * sensitive, unlike the actual records (machines, parts, findings...)
 * universal search also covers.
 *
 * This is a second, separate source of truth from app-shell.tsx's own
 * nav arrays -- not derived from them automatically, since app-shell.tsx
 * mixes in icons, product-restriction logic, and role-based visibility
 * that a search index doesn't need. To keep the two from silently
 * drifting apart the way the Home page's product cards once did with
 * the real sidebar, nav-registry.test.ts checks every entry here
 * actually appears with a matching {label, href} pair in
 * app-shell.tsx's real source -- so a rename here without updating the
 * real nav (or vice versa) fails a test, not silently goes stale.
 */

export interface NavRegistryEntry {
  label: string;
  href: string;
  section: string;
}

export const NAV_REGISTRY: NavRegistryEntry[] = [
  // Shop
  { label: "Parts", href: "/machines/parts", section: "Shop" },
  { label: "Machines", href: "/machines", section: "Shop" },
  { label: "Assessments", href: "/assessment", section: "Shop" },
  { label: "Suppliers", href: "/suppliers", section: "Shop" },
  // Engineering
  { label: "Drawings & Data", href: "/intake", section: "Engineering" },
  { label: "CAD & Drawings", href: "/cad", section: "Engineering" },
  { label: "CNC Programs", href: "/cnc", section: "Engineering" },
  {
    label: "Tooling & Fixtures",
    href: "/production/libraries",
    section: "Engineering",
  },
  // Production
  { label: "Jobs", href: "/production", section: "Production" },
  { label: "Floor View", href: "/floor", section: "Production" },
  {
    label: "Improvements",
    href: "/machines/improvements",
    section: "Production",
  },
  {
    label: "Work Instructions",
    href: "/work-instructions",
    section: "Production",
  },
  { label: "Quality", href: "/quality", section: "Production" },
  { label: "Projects", href: "/projects", section: "Production" },
  // Reports
  { label: "Readiness", href: "/dashboard", section: "Reports" },
  { label: "Sustainment", href: "/sustainment", section: "Reports" },
  { label: "Findings", href: "/findings", section: "Reports" },
  { label: "Ask IronIQ", href: "/ask-ironiq", section: "Reports" },
];
