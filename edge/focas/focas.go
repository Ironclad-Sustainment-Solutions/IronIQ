//go:build cgo_focas

// Package focas is a read-only FOCAS2 Ethernet client for Fanuc-controlled
// machines, for the machines in the fleet that are genuine Fanuc
// controls (not Haas NGC, which speaks MTConnect via edge/mtconnect
// instead). Like edge/mtconnect, this never writes to the control --
// only ever reads status, alarms, and program info.
//
// ============================================================================
// READ THIS BEFORE COMPILING OR RUNNING THIS FILE AGAINST A REAL MACHINE
// ============================================================================
//
// This file has NEVER been compiled or tested. It was written against
// FOCAS2 function names and call patterns that are publicly documented
// in Fanuc's own FOCAS2 manual and widely referenced in third-party
// Fanuc-integration projects -- cnc_allclibhndl3, cnc_freelibhndl,
// cnc_statinfo, cnc_rdprgnum, and cnc_alarm2 are real, standard FOCAS2
// functions, not invented.
//
// What is NOT verified, and must be checked against Fanuc's actual
// fwlib32.h before this is trusted:
//   - The exact C struct layouts below (ODBST, ODBPRO) -- field order,
//     types, and padding must byte-for-byte match Fanuc's real header.
//     A wrong struct layout does NOT necessarily fail to compile against
//     a real Fwlib32.dll -- C links by memory layout, not by field name,
//     so a subtly wrong struct can silently produce garbage data instead
//     of an error. REPLACE the struct definitions in the cgo preamble
//     below with the real ones from Fanuc's fwlib32.h before relying on
//     this for anything.
//   - Whether these specific CNC series/versions even support FOCAS2
//     Ethernet access -- this is often a separate paid option on the
//     control ("Ethernet board" / "Data Server" function), not present
//     on every Fanuc-controlled machine by default.
//   - Return/status code handling -- FOCAS2 functions return a `short`
//     result code where 0 means success and negative values are
//     documented error codes; the mapping used below (treat any
//     non-zero as a hard failure) is a conservative default, not
//     verified against real hardware behavior.
//
// This package requires CGO_ENABLED=1 and Fanuc's real Fwlib32.dll (or
// Linux equivalent, if one exists for the target CNC series) plus its
// header on the build machine's include/library path -- neither of
// which this project has ever had access to. Build with:
//
//	CGO_ENABLED=1 go build -tags cgo_focas .
//
// and only after an engineer with real access to one of these machines
// has verified the struct layouts and confirmed FOCAS2 is actually
// enabled on it.
// ============================================================================
package focas

/*
#cgo LDFLAGS: -lfwlib32
#include <stdlib.h>

// --- Everything below this line is a best-effort reconstruction of the
// relevant parts of Fanuc's fwlib32.h, NOT a copy of Fanuc's real header
// (which this project does not have). Field layouts especially must be
// verified against the real header before this is trusted -- see the
// package-level warning above.

typedef struct odbst {
    short   dummy;
    short   tmmode;
    short   aut;
    short   run;
    short   motion;
    short   mstb;
    short   estop;
    short   alarm;
    short   edit;
} ODBST;

typedef struct odbpro {
    long    dummy;
    long    data;
} ODBPRO;

short cnc_allclibhndl3(const char *ip, unsigned short port, long timeout, unsigned short *handle);
short cnc_freelibhndl(unsigned short handle);
short cnc_statinfo(unsigned short handle, ODBST *statinfo);
short cnc_rdprgnum(unsigned short handle, ODBPRO *prgnum);
*/
import "C"

import (
	"context"
	"fmt"
	"strconv"
	"time"
	"unsafe"

	"ironiq-edge/reading"
)

// Fanuc's own documented "run" status values for ODBST.run. Treated the
// same way as MTConnect's Execution states are in edge/mtconnect --
// mapped toward RUNNING / IDLE / DOWN, not passed through raw.
const (
	runStop  = 0
	runHold  = 1
	runStart = 3 // cutting
	runMSTR  = 4
)

// Current connects to a Fanuc control over FOCAS2 Ethernet, reads status
// and the current program number, and maps them to the same Reading
// shape edge/mtconnect produces -- so mapper.Tracker never needs to know
// which protocol a given machine actually speaks.
func Current(ctx context.Context, host string, port int) (*reading.Reading, error) {
	cHost := C.CString(host)
	defer C.free(unsafe.Pointer(cHost))

	var handle C.ushort
	// timeout is in seconds per FOCAS2's documented signature.
	rc := C.cnc_allclibhndl3(cHost, C.ushort(port), C.long(10), &handle)
	if rc != 0 {
		return nil, fmt.Errorf("cnc_allclibhndl3(%s:%d) failed, FOCAS result code %d", host, port, int(rc))
	}
	defer C.cnc_freelibhndl(handle)

	var status C.ODBST
	if rc := C.cnc_statinfo(handle, &status); rc != 0 {
		return nil, fmt.Errorf("cnc_statinfo failed, FOCAS result code %d", int(rc))
	}

	var prog C.ODBPRO
	if rc := C.cnc_rdprgnum(handle, &prog); rc != 0 {
		return nil, fmt.Errorf("cnc_rdprgnum failed, FOCAS result code %d", int(rc))
	}

	state := "IDLE"
	switch int(status.run) {
	case runStart, runMSTR:
		state = "RUNNING"
	case runStop, runHold:
		state = "IDLE"
	}
	if int(status.estop) != 0 || int(status.alarm) != 0 {
		state = "DOWN"
	}

	r := &reading.Reading{
		DeviceName:   fmt.Sprintf("%s:%d", host, port),
		Timestamp:    time.Now().UTC().Format(time.RFC3339),
		State:        state,
		RawExecution: strconv.Itoa(int(status.run)),
		ProgramName:  strconv.Itoa(int(prog.data)),
		AlarmActive:  int(status.alarm) != 0,
	}
	if int(status.alarm) != 0 {
		// FOCAS2's real alarm detail call (cnc_alarm2) returns
		// variable-length alarm messages and is meaningfully more
		// involved to bind correctly than the fixed-size structs
		// above -- deliberately not attempted here without real
		// hardware to validate the message-buffer handling against.
		// AlarmActive is still set from ODBST.alarm above so an active
		// alarm is at least visible, just without Fanuc's own message text.
		r.AlarmCode = "UNKNOWN"
	}
	return r, nil
}
