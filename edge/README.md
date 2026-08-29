# IronIQ Edge (on-prem agent)

IronIQ cloud cannot reach a CNC on a private shop LAN. The default live
path is this Edge app, running on a PC on the shop network, **alongside**
IronIQ — not instead of it. Cloud-pull MTConnect “Sync now” stays as the
exception when a shop publishes an agent to the public internet.

This process is **not** a cloud service. It never writes a CNC (no DNC,
no Haas `?E`, no FOCAS write, no PMC G-bit write). The control stays
off the internet. IronIQ never talks to a CNC.

First proof: Haas NGC MTConnect at `http://<lan-ip>:8082/current`.

## What it does

- Polls each configured machine’s local MTConnect agent (GET `/current`,
  and `/probe` if you need to confirm the device name).
- Maps snapshots to `iss.machine_event.v1` (`state_change` / `cycle_end` /
  `alarm` / `heartbeat`), states `RUNNING|IDLE|DOWN`, `program_name`,
  cycle counters, `capture_path=mtconnect`, and `control_mode`
  `AUTO|MDI|JOG` when the XML provides it.
- POSTs to IronIQ `POST /api/ironiq/v1/machine-events` with
  `Authorization: Bearer <facility ingest key>`.
- One credential per plant (not per machine). This agent cannot post
  another organization’s machines — IronIQ scopes the key to one facility.
- Heartbeat if no other event in 60 seconds. Idle-gap `SETUP_CANDIDATE`
  is classified by IronIQ ingest, not invented here.
- Durable local buffer if IronIQ is unreachable. Retries 5xx and
  timeouts. Never retries 400.

## Get a facility key (Floor setup)

In IronIQ: open **Floor** for the facility. The **IronIQ Edge setup**
panel generates a facility ingest key and shows it **once**. Copy it
immediately. One key per plant; the same key covers every machine
registered at that facility.

Do not put the key in a URL query string. Do not use a global shared
secret. Do not post to `/api/machines/{id}/ingest` (that path is closed).

## Install on the shop LAN

1. Build a single binary (Go toolchain is only needed on the build machine):

   ```sh
   cd edge
   GOOS=linux GOARCH=amd64 go build -o ironiq-edge .
   GOOS=windows GOARCH=amd64 go build -o ironiq-edge.exe .
   GOOS=darwin GOARCH=arm64 go build -o ironiq-edge-macos-arm64 .
   ```

2. Copy the binary and a config file to a PC on the **same LAN** as the
   Haas control. The CNC does not need internet. That PC needs outbound
   HTTPS to IronIQ (same as a web browser).

3. Copy `example.config.json` to `edge.config.json` and set:

   - `ironiq_url` — your IronIQ origin, e.g. `https://ironiq.example.com`
   - `facility_key` — the Floor setup key (or set `IRONIQ_FACILITY_KEY`
     so the key is not stored in the file)
   - `plant_id` — the plant id you send on events (must be non-empty)
   - `machines` — `asset_id` matching IronIQ Machine master, plus the
     local MTConnect URL (`http://192.168.x.x:8082` for Haas NGC)

   Environment overrides: `IRONIQ_URL`, `IRONIQ_FACILITY_KEY`,
   `IRONIQ_PLANT_ID`, `IRONIQ_EDGE_CONFIG`.

4. Run:

   ```sh
   ./ironiq-edge --config edge.config.json
   ```

   Optional: Task Scheduler / systemd / cron to keep it running across
   reboots. The agent does not open a listening port.

## Network picture

```
Haas NGC  --LAN only-->  Edge app  --outbound HTTPS-->  IronIQ
 :8082 /current          (this binary)   POST /api/ironiq/v1/machine-events
                         Bearer <facility key>
```

- CNC ← nothing from Edge except GET.
- IronIQ → CNC: never.
- Cloud “Sync now”: only if you publish the MTConnect agent to the
  public internet. That is the exception, not the default.

## Fanuc machines (FOCAS) — experimental, needs an on-site engineer

A real fleet is often a mix of Haas (MTConnect, described above) and
genuine Fanuc-controlled machines. Fanuc controls don't speak MTConnect
natively — the standard way to read one is FOCAS, Fanuc's own
proprietary SDK (`Fwlib32.dll` on Windows, licensed from Fanuc or a
system integrator), not an open spec like MTConnect.

**This has never been compiled or tested.** `edge/focas/focas.go`
(guarded by the `cgo_focas` build tag, so it's never part of the default
build) is a best-effort scaffold written against FOCAS2 function names
that are publicly documented in Fanuc's own manual
(`cnc_allclibhndl3`, `cnc_statinfo`, `cnc_rdprgnum`) — but the C struct
layouts in that file are a reconstruction, not a copy of Fanuc's real
`fwlib32.h`, and this project has never had access to Fanuc's actual
library to link against or test with. See the large warning comment at
the top of `edge/focas/focas.go` for exactly what needs verification
before this is trusted near a real machine.

Before anyone runs this against a live Fanuc control, someone with
physical or remote access needs to:

1. Confirm the control actually has Ethernet/FOCAS2 access enabled —
   on many Fanuc controls this is a separate paid option (often called
   an Ethernet board or "Data Server" function), not present by default.
2. Get Fanuc's real `Fwlib32.dll` (or Linux equivalent, if one exists
   for that CNC series) and its header, licensed from Fanuc or a system
   integrator.
3. Replace the placeholder `ODBST`/`ODBPRO` struct definitions in
   `edge/focas/focas.go` with the real ones from Fanuc's header —
   getting this wrong doesn't necessarily fail to compile, it can
   silently produce garbage data instead, since C links by memory
   layout, not field name.
4. Build with `CGO_ENABLED=1 go build -tags cgo_focas .` and validate
   against the real machine before trusting any of its output.

To use it once validated, set `"protocol": "focas"` on that machine in
the config (`focas_host`/`focas_port` instead of `mtconnect_url`) — see
`example.config.json` for a mixed Haas+Fanuc fleet.

## Tests

```sh
cd edge
go test ./...
```

The command above only exercises the default build (no `cgo_focas` tag)
— `edge/focas`'s stub, which is all that's testable without Fanuc's real
library. It does not, and cannot, test `focas.go` itself.

