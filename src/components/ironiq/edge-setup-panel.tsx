import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Panel } from "@/components/ironiq/layout-primitives";
import { Button } from "@/components/ui/button";
import {
  useEdgeIngestKeyInfo,
  useGenerateEdgeIngestKey,
} from "@/lib/edge-ingest-admin-api";
import { formatDate } from "@/lib/utils";
import { buildEdgeConfigJson } from "@/lib/edge-config-generator";

/**
 * The one canonical "how do I connect a machine" panel -- facility key
 * generation plus the four platform downloads. Used everywhere someone
 * might reasonably look for this: Floor (first-setup empty state), the
 * Machines list (the natural top-level home for "how do I connect a
 * machine," since machines are what's actually being connected), and
 * the machine detail page (always available, including key rotation).
 * Kept as one shared component specifically so these three call sites
 * can't quietly drift out of sync with each other the way the Home
 * page's product cards did with the sidebar.
 */
export function EdgeSetupPanel({
  facilityId,
  plantId,
}: {
  facilityId: string;
  /** Falls back to the facility ID itself if the caller doesn't have a nicer name on hand. */
  plantId?: string;
}) {
  const keyInfo = useEdgeIngestKeyInfo(facilityId);
  const generateKey = useGenerateEdgeIngestKey(facilityId);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);

  function downloadConfig() {
    if (!revealedKey) return;
    const json = buildEdgeConfigJson({
      baseUrl: window.location.origin,
      facilityKey: revealedKey,
      plantId: plantId || facilityId,
    });
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "edge.config.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Panel title="IronIQ Edge setup">
      <p className="text-sm text-muted-foreground">
        Live LAN feeds use the Edge app on the shop network, not cloud pull.
        Floor reads events the Edge app pushes; IronIQ never talks to a CNC.
        Generate a facility key below (shown once) and point the Edge app at{" "}
        <code className="text-foreground">
          POST /api/ironiq/v1/machine-events
        </code>
        .
      </p>

      {revealedKey ? (
        <div className="mt-3 rounded-md bg-muted p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Edge ingest key — copy it now, it won't be shown again
          </p>
          <code className="mt-1 block break-all text-sm text-foreground">
            {revealedKey}
          </code>
          <p className="mt-2 text-xs text-muted-foreground">
            One key per facility, not per machine — your edge box can post
            events for any machine registered at this facility using this same
            key.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={downloadConfig}
          >
            Download edge.config.json
          </Button>
          <p className="mt-2 text-xs text-muted-foreground">
            This is the only file the Edge app needs, and the only time you'll
            need to touch it — it fetches its machine list from IronIQ directly
            every time it starts. Add or edit machines, change a protocol, or
            update a connection URL in the app, and the Edge app picks it up
            automatically within a few minutes, with nothing to redownload.
          </p>
        </div>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">
          {keyInfo.data?.hint
            ? `Active key ends in …${keyInfo.data.hint} (created ${
                keyInfo.data.createdAt
                  ? formatDate(keyInfo.data.createdAt)
                  : "recently"
              }). Generating a new one replaces it immediately.`
            : "No edge ingest key yet — generate one to connect an edge box."}
        </p>
      )}

      <Button
        variant="outline"
        className="mt-3"
        disabled={generateKey.isPending}
        onClick={() =>
          generateKey.mutate(undefined, {
            onSuccess: (result) => setRevealedKey(result.apiKey),
          })
        }
      >
        {generateKey.isPending
          ? "Generating…"
          : keyInfo.data?.hint
            ? "Generate new key"
            : "Generate edge ingest key"}
      </Button>

      <div className="mt-4 border-t border-border pt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Download the Edge app
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          A single file, no install required — copy it to any Windows PC on the
          same shop network as your MTConnect-capable machines and run it with
          the key above. Windows only for now — not yet code-signed — see{" "}
          <Link
            to="/machines/edge-setup-guide"
            className="underline underline-offset-2 hover:text-foreground"
          >
            the setup guide
          </Link>{" "}
          for what Windows will show and how to verify the download instead.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <a
            href="/downloads/ironiq-edge-windows-amd64.exe"
            download
            className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-primary/50 hover:bg-muted/20"
          >
            Windows (64-bit)
          </a>
          <a
            href="/downloads/install-service.bat"
            download
            className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-primary/50 hover:bg-muted/20"
          >
            Windows service installer
          </a>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Prefer not to use a command prompt? Download both the Windows .exe and
          the service installer above into the same folder along with your
          edge.config.json, then double-click{" "}
          <code className="text-foreground">install-service.bat</code> — it
          handles the admin prompt and installs it as an auto-starting service
          for you.
        </p>
        <div className="mt-2 flex flex-wrap gap-3 text-xs">
          <a
            href="/downloads/CHECKSUMS.txt"
            className="underline underline-offset-2 text-muted-foreground hover:text-foreground"
          >
            SHA-256 checksums
          </a>
          <a
            href="/downloads/VERSION.txt"
            className="underline underline-offset-2 text-muted-foreground hover:text-foreground"
          >
            Version info
          </a>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          See the{" "}
          <Link
            to="/machines/edge-setup-guide"
            className="underline underline-offset-2 hover:text-foreground"
          >
            IronIQ Edge setup guide
          </Link>{" "}
          for exact setup steps and config options.
        </p>
      </div>
    </Panel>
  );
}
