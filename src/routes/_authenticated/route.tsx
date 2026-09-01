import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { getCurrentUser, logout } from "@/lib/auth/auth.functions";
import { AppProvider } from "@/context/app-context";
import { AppShell } from "@/components/ironiq/app-shell";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const user = await getCurrentUser();
    if (!user)
      throw redirect({ to: "/auth", search: { oauth_error: undefined } });
    // Defense in depth: login() already blocks unapproved accounts from
    // ever getting a session, but if an admin revokes approval on someone
    // who's already signed in, this catches that on their next navigation
    // rather than leaving a stale session with access.
    if (user.profile?.approved === false) {
      await logout();
      throw redirect({ to: "/auth", search: { oauth_error: undefined } });
    }
    return { user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  return (
    <AppProvider>
      <AppShell>
        <Outlet />
      </AppShell>
    </AppProvider>
  );
}
