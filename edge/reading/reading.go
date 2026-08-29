// Package reading defines the one snapshot shape every protocol collector
// (mtconnect, focas, ...) produces, so mapper.Tracker only needs to know
// about this shared shape, not about any particular protocol. Extracted
// out of the mtconnect package specifically so a second collector
// (FOCAS) can feed the exact same event pipeline without mapper.go ever
// needing to know which protocol a given machine actually uses.
package reading

// Reading is one point-in-time snapshot, mapped toward iss.machine_event.v1.
// Every field is protocol-agnostic -- a collector's job is entirely to
// populate this struct correctly for its own protocol; nothing else in
// the agent (mapper, buffer, ingest) needs to know how it got there.
type Reading struct {
	DeviceName    string
	Sequence      *int64
	Timestamp     string
	State         string // RUNNING | IDLE | DOWN
	RawExecution  string
	ProgramName   string
	PartCount     *int64
	ControlMode   *string // AUTO | MDI | JOG
	AlarmCode     string
	AlarmActive   bool
	EmergencyStop string
	CuttingTimeS  *float64
	SpindleOnS    *float64
}
