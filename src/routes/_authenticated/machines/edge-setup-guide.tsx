import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { PageHeader, Panel } from "@/components/ironiq/layout-primitives";

export const Route = createFileRoute(
  "/_authenticated/machines/edge-setup-guide",
)({
  head: () => ({
    meta: [
      { title: "IronIQ Edge setup guide — IronIQ" },
      {
        name: "description",
        content:
          "How to install and run the IronIQ Edge agent on your shop LAN, including the FOCAS/Fanuc limitations.",
      },
    ],
  }),
  component: EdgeSetupGuidePage,
});

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs text-foreground">
      <code>{children}</code>
    </pre>
  );
}

function EdgeSetupGuidePage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <Link
        to="/machines"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" aria-hidden /> Machines
      </Link>

      <PageHeader
        eyebrow="Machines"
        title="IronIQ Edge setup guide"
        description="How the Edge agent works, and exactly how to get it running on your shop network."
      />

      <Panel title="What it does">
        <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
          <li>
            Polls each configured machine's local MTConnect agent (or, for Fanuc
            controls, FOCAS — see the warning below) and maps what it reads to a
            state of <code className="text-foreground">RUNNING</code>,{" "}
            <code className="text-foreground">IDLE</code>, or{" "}
            <code className="text-foreground">DOWN</code>, plus program name and
            cycle counters.
          </li>
          <li>
            Pushes those readings to IronIQ over HTTPS, authenticated with your
            facility's ingest key — never a query string, never a global shared
            secret.
          </li>
          <li>
            One credential per facility, not per machine — the agent can post
            for any machine registered at your facility, and cannot touch any
            other organization's machines.
          </li>
          <li>
            Buffers locally if IronIQ is briefly unreachable, and retries
            automatically. Never opens a listening port, and never writes
            anything back to a CNC — read-only, always.
          </li>
        </ul>
      </Panel>

      <Panel title="1. Get a facility key">
        <p className="text-sm text-muted-foreground">
          On this facility's{" "}
          <Link
            to="/machines"
            className="underline underline-offset-2 hover:text-foreground"
          >
            Machines page
          </Link>{" "}
          or the{" "}
          <Link
            to="/floor"
            className="underline underline-offset-2 hover:text-foreground"
          >
            Floor page
          </Link>
          , find the "IronIQ Edge setup" panel and generate a key. It's shown
          exactly once — copy it immediately. One key covers every machine at
          this facility.
        </p>
      </Panel>

      <Panel title="2. Download and place the agent">
        <p className="text-sm text-muted-foreground">
          Download the right file for the PC you'll run it on from the same
          "IronIQ Edge setup" panel (Windows, macOS Intel/Apple Silicon, or
          Linux). It's a single file — nothing to install. Copy it to any PC on
          the <strong className="text-foreground">same local network</strong> as
          your machines. That PC needs normal outbound internet access (the same
          kind a web browser uses); your CNC controls never need internet access
          at all.
        </p>
      </Panel>

      <Panel title="Security: verify your download, and what to expect from your OS">
        <p className="text-sm text-muted-foreground">
          <strong className="text-foreground">
            This binary is not yet code-signed.
          </strong>{" "}
          Code signing (a paid certificate from a certificate authority, plus
          Apple notarization for macOS) is planned but not done yet. Until then:
        </p>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
          <li>
            <strong className="text-foreground">Windows</strong> will likely
            show a SmartScreen warning ("Windows protected your PC"). Click{" "}
            <em>More info</em>, then <em>Run anyway</em> — only after verifying
            the checksum below.
          </li>
          <li>
            <strong className="text-foreground">macOS</strong> will block the
            file outright the first time ("cannot be opened because the
            developer cannot be verified"). Right-click the file, choose{" "}
            <em>Open</em>, then confirm — this only needs to happen once per
            machine.
          </li>
          <li>
            Some antivirus/EDR software flags new, unsigned executables by
            default, even when there's nothing actually wrong with them. If
            yours does, verify the checksum below and inform your IT team rather
            than disabling protection entirely.
          </li>
        </ul>
        <p className="mt-3 text-sm text-muted-foreground">
          <strong className="text-foreground">
            Verify the file you downloaded matches what IronIQ actually built,
          </strong>{" "}
          using the{" "}
          <a
            href="/downloads/CHECKSUMS.txt"
            className="underline underline-offset-2 hover:text-foreground"
          >
            published SHA-256 checksums
          </a>
          :
        </p>
        <CodeBlock>{`# Windows (PowerShell)
Get-FileHash .\\ironiq-edge-windows-amd64.exe -Algorithm SHA256

# macOS / Linux
shasum -a 256 ironiq-edge-linux-amd64`}</CodeBlock>
        <p className="mt-3 text-sm text-muted-foreground">
          Compare the result against the matching line in CHECKSUMS.txt. If they
          don't match exactly, don't run the file — re-download it, and if it
          still doesn't match, contact IronIQ before proceeding.
        </p>
      </Panel>

      <Panel title="3. Configure it">
        <p className="mb-3 text-sm text-muted-foreground">
          Create a config file (JSON) next to the downloaded binary:
        </p>
        <CodeBlock>{`{
  "ironiq_url": "https://<your-ironiq-domain>",
  "facility_key": "<the key from step 1>",
  "plant_id": "<any short name for this plant>",
  "machines": [
    {
      "asset_id": "<matches this machine's Asset ID in IronIQ>",
      "protocol": "mtconnect",
      "mtconnect_url": "http://<machine-lan-ip>:8082",
      "controller_make": "Haas"
    }
  ]
}`}</CodeBlock>
        <p className="mt-3 text-sm text-muted-foreground">
          You can also set{" "}
          <code className="text-foreground">IRONIQ_FACILITY_KEY</code> as an
          environment variable instead of putting the key directly in the file.
          Each entry in <code className="text-foreground">machines</code> needs
          an <code className="text-foreground">asset_id</code> that matches a
          real machine already in IronIQ's Machine master.
        </p>
        <p className="mt-3 text-sm text-muted-foreground">
          <strong className="text-foreground">Two habits worth keeping:</strong>{" "}
          run this as a standard user account, not an administrator/root — it
          never needs elevated privileges for anything it does. And prefer the{" "}
          <code className="text-foreground">IRONIQ_FACILITY_KEY</code>{" "}
          environment variable over the config file where you can; if you do
          keep the key in the file, restrict who can read that file on the PC
          it's running on. The key only grants write access for this one
          facility's events, but there's no reason to leave it more exposed than
          it needs to be.
        </p>
      </Panel>

      <Panel title="4. Run it">
        <CodeBlock>{`./ironiq-edge --config edge.config.json`}</CodeBlock>
        <p className="mt-3 text-sm text-muted-foreground">
          Optional: wire it into Task Scheduler (Windows), systemd, or cron if
          you want it to keep running across reboots — that's your choice, not a
          requirement. The agent never opens a listening port, so there's
          nothing else to configure on the network side.
        </p>
        <p className="mt-3 text-sm text-muted-foreground">
          Run <code className="text-foreground">./ironiq-edge --version</code>{" "}
          at any time to confirm exactly which build you have — useful for
          support, and for confirming it matches the{" "}
          <a
            href="/downloads/VERSION.txt"
            className="underline underline-offset-2 hover:text-foreground"
          >
            latest published version
          </a>
          .
        </p>
      </Panel>

      <Panel title="How the connection actually flows">
        <CodeBlock>{`Your machine (LAN only)  -->  Edge app  --outbound HTTPS-->  IronIQ
    :8082 /current           (this file)   your facility's ingest key`}</CodeBlock>
        <p className="mt-3 text-sm text-muted-foreground">
          Nothing reaches your machine except the Edge app's own read requests.
          IronIQ's cloud never talks to a CNC directly, and never could — this
          is why the Edge app exists in the first place.
        </p>
      </Panel>

      <Panel title="Fanuc-controlled machines — read this before trying">
        <p className="text-sm text-muted-foreground">
          Fanuc controls don't speak MTConnect natively — they need FOCAS,
          Fanuc's own proprietary interface, which requires Fanuc's licensed
          software and, on many controls, a separate paid option just to enable
          network access at all.
        </p>
        <p className="mt-3 text-sm text-muted-foreground">
          <strong className="text-foreground">
            FOCAS support in the Edge app is experimental and has never been
            verified against a real Fanuc control.
          </strong>{" "}
          If you have Fanuc-controlled machines, an engineer with physical or
          remote access to one needs to confirm FOCAS is actually enabled and
          validate the connection before this is trusted for real production
          data. Reach out before attempting this on a live machine.
        </p>
      </Panel>
    </div>
  );
}
