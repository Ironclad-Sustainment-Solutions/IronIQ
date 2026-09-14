//go:build windows

// Makes the agent behave as a real Windows Service when installed and
// started by Windows' Service Control Manager (SCM) -- not just a
// program someone remembers to keep a terminal window open for.
//
// A plain console program registered with `sc.exe create` WITHOUT
// speaking SCM's actual control protocol (calling
// StartServiceCtrlDispatcher, responding to Stop/Shutdown, reporting
// status back) gets reported by Windows as "did not respond to the
// start or control request in a timely fashion" (Error 1053), even
// though the underlying process is genuinely running and doing real
// work -- SCM specifically expects that handshake, not just a running
// process. golang.org/x/sys/windows/svc implements the real protocol;
// this file is what plugs this agent's actual work (runAgentLoop, in
// main.go) into it.
//
// ============================================================================
// VERIFICATION STATUS -- read this before relying on it
// ============================================================================
// This has never been run against a real Windows Service Control
// Manager. This sandbox has no Windows environment at all, so nothing
// here could be executed the way the rest of this project's code has
// been -- only cross-compiled to confirm it builds for the windows/amd64
// target. The API calls below (svc.Run, svc.IsWindowsService,
// mgr.Connect/CreateService/Delete, the Config fields and constants)
// were checked directly against golang.org/x/sys's real, current source
// (vendored into edge/vendor/ -- see go.mod) before writing this, not
// written from memory -- but "matches the documented API" and "actually
// works when Windows' real SCM drives it" are different levels of
// confidence. Treat this the same way as edge/focas: needs a real
// Windows machine to install and start the service on before trusting
// it for a real, unattended production deployment.
// ============================================================================

package main

import (
	"context"
	"fmt"
	"os"
	"path/filepath"

	"golang.org/x/sys/windows"
	"golang.org/x/sys/windows/svc"
	"golang.org/x/sys/windows/svc/mgr"
)

const windowsServiceName = "IronIQEdge"

func isRunningAsWindowsService() bool {
	isSvc, err := svc.IsWindowsService()
	if err != nil {
		// Fails safe: if this can't even be determined, assume "not a
		// service" so the program falls back to normal console
		// behavior (visible errors, the double-click pause fix)
		// instead of silently trying to speak a protocol that might not
		// actually be listening.
		return false
	}
	return isSvc
}

type windowsServiceHandler struct {
	cfg Config
	a   *agent
}

// Execute is SCM's actual entry point once svc.Run hands control over --
// everything from here on is this package speaking the real Windows
// service protocol, not just "the program happens to be running."
func (h *windowsServiceHandler) Execute(
	_ []string,
	requests <-chan svc.ChangeRequest,
	status chan<- svc.Status,
) (svcSpecificEC bool, exitCode uint32) {
	status <- svc.Status{State: svc.StartPending}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	stop := make(chan struct{})
	loopDone := make(chan struct{})
	go func() {
		runAgentLoop(ctx, h.a, h.cfg, stop)
		close(loopDone)
	}()

	status <- svc.Status{
		State:   svc.Running,
		Accepts: svc.AcceptStop | svc.AcceptShutdown,
	}

	for {
		select {
		case req := <-requests:
			switch req.Cmd {
			case svc.Interrogate:
				status <- req.CurrentStatus
			case svc.Stop, svc.Shutdown:
				status <- svc.Status{State: svc.StopPending}
				cancel()
				close(stop)
				<-loopDone
				status <- svc.Status{State: svc.Stopped}
				return false, 0
			}
		case <-loopDone:
			// The loop ended on its own (shouldn't normally happen --
			// it only returns on ctx/stop -- but handled rather than
			// leaving SCM waiting forever if it ever does).
			status <- svc.Status{State: svc.Stopped}
			return false, 1
		}
	}
}

// runAsWindowsService hands control to svc.Run, which blocks for as
// long as the service is running and talks to SCM on this program's
// behalf -- everything the service actually DOES happens inside
// Execute above, via the same runAgentLoop every other run mode uses.
func runAsWindowsService(cfg Config, a *agent) error {
	handler := &windowsServiceHandler{cfg: cfg, a: a}
	return svc.Run(windowsServiceName, handler)
}

func maybeHandleServiceFlags(install, uninstall bool, configPath string) (handled bool, err error) {
	if install {
		return true, installWindowsService(configPath)
	}
	if uninstall {
		return true, uninstallWindowsService()
	}
	return false, nil
}

func installWindowsService(configPath string) error {
	exePath, err := os.Executable()
	if err != nil {
		return fmt.Errorf("locate this program's own path: %w", err)
	}
	absConfigPath, err := filepath.Abs(configPath)
	if err != nil {
		return fmt.Errorf("resolve config path %q: %w", configPath, err)
	}

	m, err := mgr.Connect()
	if err != nil {
		return fmt.Errorf("connect to Windows Service Control Manager (try running as Administrator): %w", err)
	}
	defer m.Disconnect()

	// Idempotent by design: if the service is already installed, this
	// is treated as success, not an error -- confirmed and left alone,
	// not reinstalled or reconfigured. Running the install command
	// again (retrying after an earlier attempt, or just running setup
	// defensively/repeatably) should never fail just because it already
	// worked once. Reinstalling with different settings is still an
	// explicit, deliberate two-step action (-uninstall-service, then
	// -install-service again), not something this silently does on its
	// own -- a install command shouldn't have the side effect of
	// quietly changing an already-configured service's settings.
	if existing, err := m.OpenService(windowsServiceName); err == nil {
		existing.Close()
		fmt.Printf(
			"%q is already installed as a Windows Service -- nothing to do.\n"+
				"To reinstall or point it at a different config file, run -uninstall-service first, then -install-service again.\n",
			windowsServiceName,
		)
		return nil
	}

	s, err := m.CreateService(windowsServiceName, exePath, mgr.Config{
		DisplayName:  "IronIQ Edge",
		Description:  "Reads machine data on this shop's local network and reports it to IronIQ. Read-only to the CNC; never writes to it.",
		StartType:    mgr.StartAutomatic,
		ErrorControl: windows.SERVICE_ERROR_NORMAL,
	}, "--config", absConfigPath)
	if err != nil {
		return fmt.Errorf("create service: %w", err)
	}
	defer s.Close()

	fmt.Printf(
		"Installed %q as a Windows Service (starts automatically on boot), using config file %s.\n"+
			"Start it now from Services.msc, or run: sc start %s\n",
		windowsServiceName, absConfigPath, windowsServiceName,
	)
	return nil
}

func uninstallWindowsService() error {
	m, err := mgr.Connect()
	if err != nil {
		return fmt.Errorf("connect to Windows Service Control Manager (try running as Administrator): %w", err)
	}
	defer m.Disconnect()

	s, err := m.OpenService(windowsServiceName)
	if err != nil {
		return fmt.Errorf("service %q not found: %w", windowsServiceName, err)
	}
	defer s.Close()

	if err := s.Delete(); err != nil {
		return fmt.Errorf("delete service: %w", err)
	}
	fmt.Printf("Removed the %q Windows Service.\n", windowsServiceName)
	return nil
}
