package main

import "testing"

func TestShouldPauseBeforeExit(t *testing.T) {
	// The actual bug this whole file exists to fix: double-clicking the
	// .exe on Windows opens a new console that closes itself the instant
	// the process exits, so any error message flashes and vanishes
	// before it can be read. macOS/Linux don't have this problem -- the
	// shell prompt just returns with the error already visible above it
	// -- so pausing there would only be unwanted extra friction, not a
	// fix for anything real on those platforms.
	cases := map[string]bool{
		"windows": true,
		"darwin":  false,
		"linux":   false,
	}
	for goos, want := range cases {
		if got := shouldPauseBeforeExit(goos); got != want {
			t.Errorf("shouldPauseBeforeExit(%q) = %v, want %v", goos, got, want)
		}
	}
}
