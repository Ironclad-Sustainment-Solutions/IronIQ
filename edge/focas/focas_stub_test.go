//go:build !cgo_focas

package focas

import (
	"context"
	"errors"
	"testing"
)

// This is the only part of the focas package that can be tested without
// Fanuc's real FOCAS2 library -- confirming the default build (what
// every real customer gets today) fails clearly and safely rather than
// silently returning zero-value data that could be mistaken for a real
// reading of an idle/healthy machine.
func TestCurrent_StubReturnsClearError(t *testing.T) {
	r, err := Current(context.Background(), "10.0.0.5", 8193)
	if r != nil {
		t.Fatalf("expected nil reading from the stub, got %+v", r)
	}
	if !errors.Is(err, ErrNotBuiltWithFocas) {
		t.Fatalf("expected ErrNotBuiltWithFocas, got %v", err)
	}
}
