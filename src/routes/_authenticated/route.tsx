import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { getCurrentUser } from "@/lib/auth/auth.functions";
import { AppProvider } from "@/context/app-context";
import { AppShell } from "@/components/ironiq/app-shell";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const user = await getCurrentUser();
    if (!user) throw redirect({ to: "/auth" });
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
