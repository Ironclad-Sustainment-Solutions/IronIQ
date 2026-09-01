import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Panel } from "@/components/ironiq/layout-primitives";
import { Button } from "@/components/ui/button";
import {
  useEdgeIngestKeyInfo,
  useGenerateEdgeIngestKey,
} from "@/lib/edge-ingest-admin-api";
import { formatDate } from "@/lib/utils";

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
export function EdgeSetupPanel({ facilityId }: { facilityId: string }) {
  const keyInfo = useEdgeIngestKeyInfo(facilityId);
  const generateKey = useGenerateEdgeIngestKey(facilityId);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);

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
          A single file, no install required — copy it to any PC on the same
          shop network as your MTConnect-capable machines and run it with the
          key above. Not yet code-signed — see{" "}
          <Link
            to="/machines/edge-setup-guide"
            className="underline underline-offset-2 hover:text-foreground"
          >
            the setup guide
          </Link>{" "}
          for what your OS will show and how to verify the download instead.
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
            href="/downloads/ironiq-edge-macos-arm64"
            download
            className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-primary/50 hover:bg-muted/20"
          >
            macOS (Apple Silicon)
          </a>
          <a
            href="/downloads/ironiq-edge-macos-amd64"
            download
            className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-primary/50 hover:bg-muted/20"
          >
            macOS (Intel)
          </a>
          <a
            href="/downloads/ironiq-edge-linux-amd64"
            download
            className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-primary/50 hover:bg-muted/20"
          >
            Linux (64-bit)
          </a>
        </div>
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
