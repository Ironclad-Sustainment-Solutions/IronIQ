# IronIQ MTConnect bridge agent

IronIQ runs in the cloud and can't reach a machine on your local
network directly — a private LAN address (like `http://192.168.1.50:5000`)
isn't reachable from the public internet, and exposing shop-floor
control equipment directly to the internet isn't something any plant
should do. This bridge agent solves that the standard way: it runs on
any PC on the *same local network* as your MTConnect agent, reads it
locally (no firewall issue, same LAN), and pushes readings *outbound* to
IronIQ over HTTPS — outbound traffic like this is essentially always
allowed through a normal corporate firewall, the same way regular web
browsing is.

## Footprint

- **No open ports, ever.** The bridge only ever makes outbound HTTP
  requests: one to your local MTConnect agent, one to IronIQ.
- **No runtime to install.** It's a single, dependency-free native
  binary (Go's standard library only — no external packages at all).
  Copy the one file to any Windows, macOS, or Linux machine and run it.
  Nothing else to install, no Node/Python/.NET required.
- **No background service required.** Run it in a terminal, or wire it
  into Task Scheduler / cron / systemd yourself if you want it to
  survive reboots — that's your choice, not a requirement of the agent.

## Building

Requires the Go toolchain (`go.dev`) — only on whichever machine builds
the binary, never on the machine that runs it.

```sh
cd bridge

# Linux
GOOS=linux GOARCH=amd64 go build -o mtconnect-bridge-linux-amd64 .

# Windows
GOOS=windows GOARCH=amd64 go build -o mtconnect-bridge-windows-amd64.exe .

# macOS (Apple Silicon)
GOOS=darwin GOARCH=arm64 go build -o mtconnect-bridge-macos-arm64 .

# macOS (Intel)
GOOS=darwin GOARCH=amd64 go build -o mtconnect-bridge-macos-amd64 .
```

Each of these cross-compiles cleanly from any single machine with Go
installed — you don't need a Windows box to build the Windows binary.

## Running

Generate a bridge API key from the machine's detail page in IronIQ
first (Machines → your machine → MTConnect bridge agent → Generate
bridge API key). It's shown once — copy it immediately.

```sh
./mtconnect-bridge \
  --agent-url http://192.168.1.50:5000 \
  --device "VMC-3Axis" \
  --machine-id <machine-id-from-ironiq> \
  --api-key <the-key-you-just-generated> \
  --ingest-url https://<your-ironiq-domain>/api/machines/<machine-id>/ingest \
  --interval 30
```

Or via environment variables instead of flags (useful for a service
definition): `MTCONNECT_BRIDGE_AGENT_URL`, `MTCONNECT_BRIDGE_DEVICE`,
`MTCONNECT_BRIDGE_MACHINE_ID`, `MTCONNECT_BRIDGE_API_KEY`,
`MTCONNECT_BRIDGE_INGEST_URL`, `MTCONNECT_BRIDGE_INTERVAL_MS`.

`--device` can be omitted if your MTConnect agent only serves one
device. `--interval` defaults to 30 seconds.

## What it sends

Each poll reads your MTConnect agent's `/current` endpoint and pushes a
small JSON payload (execution state, part count, part number, sequence
number, timestamp) to IronIQ. IronIQ computes the actual run/idle/down
time and part-count deltas server-side — the bridge itself holds no
state between runs and doesn't need to.
