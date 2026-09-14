//go:build !windows

// Windows Service integration (service_windows.go) only makes sense on
// Windows -- Linux/macOS have their own equivalents (systemd, launchd)
// that this project doesn't wire up yet. These stubs exist so main.go
// can call isRunningAsWindowsService/maybeHandleServiceFlags
// unconditionally on every platform, without needing its own build
// tags -- the real behavior on non-Windows is simply "there is no
// Windows service here," reported clearly rather than pretending the
// flags don't exist.

package main

func isRunningAsWindowsService() bool {
	return false
}

// Never actually called (isRunningAsWindowsService always returns false
// here), but main.go references it unconditionally on every platform,
// so it still needs to exist for this package to compile on non-Windows.
func runAsWindowsService(_ Config, _ *agent) error {
	return errNotWindows
}

func maybeHandleServiceFlags(install, uninstall bool, _ string) (handled bool, err error) {
	if install || uninstall {
		return true, errNotWindows
	}
	return false, nil
}

var errNotWindows = errNotWindowsError{}

type errNotWindowsError struct{}

func (errNotWindowsError) Error() string {
	return "-install-service/-uninstall-service are only supported on Windows (this is a native Windows Service integration, not a generic cross-platform one -- Linux/macOS would need their own systemd/launchd setup instead)"
}
