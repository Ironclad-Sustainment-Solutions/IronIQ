import { Panel } from "@/components/ironiq/layout-primitives";

/**
 * Replaces the old, directly-customer-facing "download the Edge app,
 * generate a key" panel on Machines/Floor -- that setup is carried out
 * by Ironclad's own staff as part of an on-site engagement now (see
 * edge-ingest-admin.functions.ts's requirePlatformStaff, the real,
 * server-enforced reason this isn't just a UI change), not a self-serve
 * action a customer account can take. This stays on customer-facing
 * pages specifically so "why can't I see a live feed yet" has a visible,
 * honest answer instead of the setup panel silently disappearing with
 * no explanation at all.
 */
export function EdgeSetupManagedByIronclad() {
  return (
    <Panel title="Live LAN feeds">
      <p className="text-sm text-muted-foreground">
        A live feed from this machine is set up by your Ironclad team as part of
        your engagement, using the IronIQ Edge app on your shop network — not
        something you need to configure yourself. If you'd like a live
        connection set up, or want to change which machines are connected, reach
        out to your Ironclad contact.
      </p>
    </Panel>
  );
}
