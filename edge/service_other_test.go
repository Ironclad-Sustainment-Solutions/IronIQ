//go:build !windows

package main

import "testing"

func TestIsRunningAsWindowsService_AlwaysFalseOnNonWindows(t *testing.T) {
	if isRunningAsWindowsService() {
		t.Fatal("expected isRunningAsWindowsService to always return false on a non-Windows build")
	}
}

func TestMaybeHandleServiceFlags_NonWindows(t *testing.T) {
	// Neither flag set: not handled, no error -- main() should just
	// continue on to run normally.
	handled, err := maybeHandleServiceFlags(false, false, "edge.config.json")
	if handled {
		t.Error("expected handled=false when neither service flag is set")
	}
	if err != nil {
		t.Errorf("expected no error when neither service flag is set, got %v", err)
	}

	// -install-service on a non-Windows build: handled=true (main()
	// should exit, not fall through to running the agent normally),
	// with a clear error explaining why, not a silent no-op.
	handled, err = maybeHandleServiceFlags(true, false, "edge.config.json")
	if !handled {
		t.Error("expected handled=true for -install-service even on non-Windows (so main() exits with the error, rather than silently continuing)")
	}
	if err == nil {
		t.Fatal("expected an explanatory error for -install-service on non-Windows, got nil")
	}

	// -uninstall-service: same shape of check.
	handled, err = maybeHandleServiceFlags(false, true, "edge.config.json")
	if !handled {
		t.Error("expected handled=true for -uninstall-service even on non-Windows")
	}
	if err == nil {
		t.Fatal("expected an explanatory error for -uninstall-service on non-Windows, got nil")
	}
}

func TestRunAsWindowsService_ErrorsOnNonWindows(t *testing.T) {
	// Never actually called by main() in practice (isRunningAsWindowsService
	// is always false here), but it still needs to exist and behave
	// sanely for this package to compile cross-platform.
	if err := runAsWindowsService(Config{}, nil); err == nil {
		t.Fatal("expected runAsWindowsService to error on a non-Windows build, got nil")
	}
}
