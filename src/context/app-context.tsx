import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getCurrentUser } from "@/lib/auth/auth.functions";
import type { AppRole, Facility, Organization, Profile } from "@/lib/domain";
import { useFacilities, useOrganizations } from "@/lib/api";

type CurrentUser = { id: string; email: string | null };

interface AppContextValue {
  user: CurrentUser | null;
  profile: Profile | null;
  roles: AppRole[];
  primaryRole: AppRole;
  organizations: Organization[];
  facilities: Facility[];
  organization: Organization | null;
  facility: Facility | null;
  setOrganizationId: (id: string) => void;
  setFacilityId: (id: string) => void;
  loading: boolean;
  can: (capability: Capability) => boolean;
}

export type Capability =
  | "manage_templates"
  | "manage_organizations"
  | "conduct_assessment"
  | "finalize_assessment"
  | "reopen_assessment"
  | "manage_findings"
  | "administer";

const CAPABILITIES: Record<AppRole, Capability[]> = {
  ironiq_admin: [
    "manage_templates",
    "manage_organizations",
    "conduct_assessment",
    "finalize_assessment",
    "reopen_assessment",
    "manage_findings",
    "administer",
  ],
  consultant: [
    "manage_templates",
    "manage_organizations",
    "conduct_assessment",
    "finalize_assessment",
    "reopen_assessment",
    "manage_findings",
  ],
  customer_admin: [
    "conduct_assessment",
    "finalize_assessment",
    "reopen_assessment",
    "manage_findings",
    "administer",
  ],
  facility_manager: ["conduct_assessment", "manage_findings"],
  assessor: ["conduct_assessment"],
  executive: [],
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [facilityId, setFacilityId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void getCurrentUser().then((current) => {
      if (!active) return;
      if (!current) {
        setUser(null);
        setProfile(null);
        setRoles([]);
        return;
      }
      setUser({ id: current.id, email: current.email });
      setProfile((current.profile as unknown as Profile) ?? null);
      setRoles((current.roles ?? []) as AppRole[]);
    });
    return () => {
      active = false;
    };
  }, []);

  const orgsQuery = useOrganizations();
  const organizations = orgsQuery.data ?? [];
  const currentOrgId = organizationId ?? organizations[0]?.id ?? null;

  const facilitiesQuery = useFacilities(currentOrgId ?? undefined);
  const facilities = facilitiesQuery.data ?? [];
  const currentFacilityId = facilityId ?? facilities[0]?.id ?? null;

  const primaryRole: AppRole = roles.includes("ironiq_admin")
    ? "ironiq_admin"
    : roles.includes("consultant")
      ? "consultant"
      : roles.includes("customer_admin")
        ? "customer_admin"
        : roles.includes("facility_manager")
          ? "facility_manager"
          : roles.includes("assessor")
            ? "assessor"
            : "executive";

  const value = useMemo<AppContextValue>(
    () => ({
      user,
      profile,
      roles,
      primaryRole,
      organizations,
      facilities,
      organization: organizations.find((o) => o.id === currentOrgId) ?? null,
      facility: facilities.find((f) => f.id === currentFacilityId) ?? null,
      setOrganizationId: (id: string) => {
        setOrganizationId(id);
        setFacilityId(null);
      },
      setFacilityId,
      loading: orgsQuery.isLoading || facilitiesQuery.isLoading,
      can: (capability: Capability) =>
        roles.some((role) => CAPABILITIES[role]?.includes(capability)),
    }),
    [
      user,
      profile,
      roles,
      primaryRole,
      organizations,
      facilities,
      currentOrgId,
      currentFacilityId,
      orgsQuery.isLoading,
      facilitiesQuery.isLoading,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
}
