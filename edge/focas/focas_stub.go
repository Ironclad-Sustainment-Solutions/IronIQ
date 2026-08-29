//go:build !cgo_focas

// This file is compiled by default -- i.e. for every customer who does
// NOT have Fanuc's real FOCAS2 library (Fwlib32.dll or equivalent)
// available at build time, which as of this writing is everyone,
// because nobody has supplied one yet. It exists so that importing this
// package, and therefore building the agent at all, never silently
// requires cgo or a Fanuc SDK the vast majority of deployments
// (currently: every real one) will never have.
//
// To get the real implementation (focas.go, guarded by the cgo_focas
// build tag) instead of this stub, you need:
//   - Fanuc's actual FOCAS2 library file (Fwlib32.dll on Windows, or the
//     Linux equivalent if Fanuc offers one for the target CNC series --
//     confirm this, FOCAS's Linux support is much less common than
//     Windows) and its header (fwlib32.h), licensed from Fanuc or a
//     system integrator -- this project has never had access to either
//     and cannot verify anything in focas.go compiles or behaves
//     correctly against a real control as a result
//   - Confirmation the specific CNC has Ethernet/FOCAS2 access enabled
//     -- on many Fanuc controls this is a separate, paid option (often
//     called an Ethernet board or "Data Server" function), not
//     something every Fanuc-controlled machine has by default
//   - `go build -tags cgo_focas` with CGO_ENABLED=1 and the real
//     library/header on the include/library path
package focas

import (
	"context"
	"errors"

	"ironiq-edge/reading"
)

var ErrNotBuiltWithFocas = errors.New(
	"this build of the IronIQ Edge agent was not built with real FOCAS support (missing Fanuc's licensed FOCAS2 library) -- see edge/focas/focas_stub.go for what's needed",
)

// Current matches the real implementation's signature so agent.go can
// call this unconditionally regardless of which build tag was used.
func Current(ctx context.Context, host string, port int) (*reading.Reading, error) {
	return nil, ErrNotBuiltWithFocas
}
