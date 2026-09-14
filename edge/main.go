// Command ironiq-edge is the on-prem IronIQ Edge agent. It lives on the
// shop LAN, READ-ONLY polls Haas NGC MTConnect, and POSTs iss.machine_event.v1
// to POST /api/ironiq/v1/machine-events with a per-facility ingest key.
//
// It is not a cloud service. It never writes a CNC. IronIQ never talks to
// a CNC. The CNC does not need internet.
package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"log"
	"os"
	"runtime"
	"time"

	"ironiq-edge/buffer"
	"ironiq-edge/ingest"
)

// Set at build time via -ldflags "-X main.version=... -X main.buildDate=...'
// (see scripts/build-edge-binaries.sh) so a running agent's exact build is
// identifiable -- useful for support, and for confirming which build a
// SHA-256 checksum published alongside the download actually corresponds
// to. Left as "dev" for a local `go build` with no ldflags.
var (
	version   = "dev"
	buildDate = "unknown"
)

// How often the agent re-fetches its machine list from IronIQ when
// running in dynamic mode (see agent.go's refreshMachines). Not
// configurable yet -- five minutes is a reasonable default balance
// between "a protocol/URL change in the app takes effect reasonably
// promptly" and "don't poll an endpoint that changes rarely on every
// tick."
const machineListRefreshInterval = 5 * time.Minute

// Real bug this exists to fix: on Windows, double-clicking the .exe (a
// completely normal first instinct for a downloaded program, even though
// the setup guide says to run it from a command prompt) opens a brand
// new console window for the process. If the program hits an error and
// exits quickly -- most commonly, no config file next to it yet, since
// someone just downloaded the raw binary -- Windows closes that console
// window automatically the moment the process exits, before there's any
// chance to read what the error even was. From the outside this looks
// like nothing happened at all: a window outline appears and vanishes.
// Pausing for a keypress on any hard-exit path fixes this specifically
// on Windows (macOS/Linux terminal usage doesn't have this problem --
// the shell prompt just returns, with the error already visible above
// it). Confirmed this doesn't introduce a hang in a non-interactive
// context (Task Scheduler, no real console attached) by testing the
// actual compiled-binary behavior with /dev/null and fully closed stdin
// directly -- fmt.Scanln() returns immediately with no input available,
// it does not block waiting for a real interactive terminal that isn't there.
func pauseBeforeExitOnWindows() {
	if shouldPauseBeforeExit(runtime.GOOS) {
		fmt.Println("\nPress Enter to close this window...")
		fmt.Scanln()
	}
}

// Pulled out specifically so the decision itself (which platforms pause,
// which don't) is unit-testable without needing to actually execute a
// cross-compiled Windows binary to prove it.
func shouldPauseBeforeExit(goos string) bool {
	return goos == "windows"
}

// fatal prints msg, pauses on Windows so the message is actually visible
// even when double-clicked, then exits 1. Every hard-exit path in main()
// goes through this -- no bare os.Exit(1) calls that could bypass the pause.
func fatal(format string, args ...any) {
	fmt.Fprintf(os.Stderr, format+"\n", args...)
	pauseBeforeExitOnWindows()
	os.Exit(1)
}

func main() {
	configPath := flag.String("config", envOr("IRONIQ_EDGE_CONFIG", "edge.config.json"), "path to JSON config (machines + IronIQ URL)")
	showVersion := flag.Bool("version", false, "print version and build date, then exit")
	installService := flag.Bool("install-service", false, "(Windows only) install this program as a Windows Service that starts automatically on boot, then exit")
	uninstallService := flag.Bool("uninstall-service", false, "(Windows only) remove the previously installed Windows Service, then exit")
	flag.Parse()

	if *showVersion {
		fmt.Printf("ironiq-edge %s (built %s)\n", version, buildDate)
		return
	}

	cfg, err := loadConfig(*configPath)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			fatal(
				"No config file found at %q.\n\nThis program needs a config file next to it -- it's not meant to be double-clicked on its own. See the IronIQ Edge setup guide (in the IronIQ app, under Machines) for exactly what to put in it and how to run this.",
				*configPath,
			)
		}
		fatal("%v", err)
	}

	queue, err := buffer.Open(cfg.BufferPath)
	if err != nil {
		fatal("open buffer: %v", err)
	}

	client := ingest.New(cfg.IronIQURL, cfg.FacilityKey, nil)
	a := newAgent(cfg, queue, client, nil)

	if handled, err := maybeHandleServiceFlags(*installService, *uninstallService, *configPath); handled {
		if err != nil {
			fatal("%v", err)
		}
		return
	}

	if isRunningAsWindowsService() {
		// Launched by Windows' Service Control Manager, not from a
		// terminal or double-click -- must speak the actual Windows
		// service protocol (respond to Stop/Shutdown, report status
		// back to SCM) instead of just running the plain loop, or SCM
		// reports the service as failed to start even though the
		// process is really running. See service_windows.go.
		if err := runAsWindowsService(cfg, a); err != nil {
			fatal("windows service: %v", err)
		}
		return
	}

	log.SetFlags(0)
	log.Printf("IronIQ Edge %s starting (on-prem, read-only to CNC).", version)
	log.Printf("  IronIQ: %s%s", cfg.IronIQURL, ingest.Path)
	log.Printf("  Plant: %s  machines: %d  poll: %s", cfg.PlantID, len(cfg.Machines), cfg.pollInterval())
	log.Println("  CNC stays off the internet. This process only GET /current on the LAN and POSTs outbound to IronIQ.")
	log.Println("")

	runAgentLoop(context.Background(), a, cfg, nil)
}

// runAgentLoop is the actual polling loop -- shared between running
// directly (console/terminal) and running under Windows' Service
// Control Manager (service_windows.go), so there's exactly one
// implementation of "what this program actually does while running,"
// not two that could quietly drift apart. stop, if non-nil, is checked
// so a service's Stop/Shutdown request can end the loop cleanly instead
// of only ctx cancellation being able to.
func runAgentLoop(ctx context.Context, a *agent, cfg Config, stop <-chan struct{}) {
	a.refreshMachines(ctx)
	a.tick(ctx)
	ticker := time.NewTicker(cfg.pollInterval())
	defer ticker.Stop()
	refreshTicker := time.NewTicker(machineListRefreshInterval)
	defer refreshTicker.Stop()
	for {
		select {
		case <-ticker.C:
			a.tick(ctx)
		case <-refreshTicker.C:
			a.refreshMachines(ctx)
		case <-ctx.Done():
			return
		case <-stop:
			return
		}
	}
}
