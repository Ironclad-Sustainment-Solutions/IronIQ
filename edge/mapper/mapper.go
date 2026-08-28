// Package mapper turns successive MTConnect readings into iss.machine_event.v1
// events. Idle-gap SETUP_CANDIDATE is classified by IronIQ ingest, not here.
package mapper

import (
	"strings"
	"time"

	"ironiq-edge/mtconnect"
)

const (
	Schema       = "iss.machine_event.v1"
	SourceSystem = "ironiq-edge"
	CapturePath  = "mtconnect"
	Heartbeat    = 60 * time.Second
)

// Machine is the per-machine config the edge agent is allowed to post.
type Machine struct {
	AssetID         string
	ControllerMake  string
	ControllerModel string
	MachineSerial   string
}

// Quality matches iss.machine_event.v1 quality.
type Quality struct {
	SourceOK bool    `json:"source_ok"`
	Notes    *string `json:"notes"`
}

// Event is one iss.machine_event.v1 object.
type Event struct {
	Schema              string   `json:"schema"`
	PlantID             string   `json:"plant_id"`
	SourceSystem        string   `json:"source_system"`
	MachineID           string   `json:"machine_id"`
	MachineSerial       *string  `json:"machine_serial"`
	ControllerMake      *string  `json:"controller_make"`
	ControllerModel     *string  `json:"controller_model"`
	CapturePath         string   `json:"capture_path"`
	EventType           string   `json:"event_type"`
	TsUTC               string   `json:"ts_utc"`
	State               string   `json:"state"`
	PrevState           *string  `json:"prev_state"`
	ProgramName         *string  `json:"program_name"`
	PartID              *string  `json:"part_id"`
	JobID               *string  `json:"job_id"`
	CycleSeq            *int64   `json:"cycle_seq"`
	CycleTimeS          *float64 `json:"cycle_time_s"`
	RuntimeCuttingS     *float64 `json:"runtime_cutting_s"`
	SpindleOnS          *float64 `json:"spindle_on_s"`
	IdleSincePrevCycleS *float64 `json:"idle_since_prev_cycle_s"`
	GapClass            *string  `json:"gap_class"`
	AlarmCode           *string  `json:"alarm_code"`
	AlarmActive         *bool    `json:"alarm_active"`
	ControlMode         *string  `json:"control_mode"`
	Quality             *Quality `json:"quality"`
}

// Tracker diffs successive readings for one machine.
type Tracker struct {
	PlantID     string
	Machine     Machine
	last        *mtconnect.Reading
	lastEventAt time.Time
	lastCycleAt time.Time
}

// Next returns the v1 events implied by this snapshot. Heartbeat if nothing
// else has been emitted for 60s. Never sets gap_class (IronIQ ingest does).
func (t *Tracker) Next(reading *mtconnect.Reading, now time.Time) []Event {
	if reading == nil {
		return nil
	}
	ts := parseTS(reading.Timestamp, now)
	var out []Event

	if t.last == nil {
		out = append(out, t.event("state_change", reading, ts, nil))
		if reading.AlarmActive {
			out = append(out, t.alarmEvent(reading, ts))
		}
		t.last = reading
		t.lastEventAt = now
		if reading.PartCount != nil {
			t.lastCycleAt = ts
		}
		return out
	}

	if reading.State != t.last.State {
		prev := t.last.State
		out = append(out, t.event("state_change", reading, ts, &prev))
	}

	if reading.PartCount != nil && t.last.PartCount != nil && *reading.PartCount > *t.last.PartCount {
		ev := t.event("cycle_end", reading, ts, nil)
		seq := *reading.PartCount
		ev.CycleSeq = &seq
		if !t.lastCycleAt.IsZero() {
			gap := ts.Sub(t.lastCycleAt).Seconds()
			if gap >= 0 {
				ev.CycleTimeS = &gap
				if t.last.State == "IDLE" || reading.State == "IDLE" {
					ev.IdleSincePrevCycleS = &gap
				}
			}
		}
		out = append(out, ev)
		t.lastCycleAt = ts
	}

	if reading.AlarmActive != t.last.AlarmActive || reading.AlarmCode != t.last.AlarmCode {
		if reading.AlarmActive || t.last.AlarmActive {
			out = append(out, t.alarmEvent(reading, ts))
		}
	}

	if len(out) == 0 && !t.lastEventAt.IsZero() && now.Sub(t.lastEventAt) >= Heartbeat {
		out = append(out, t.event("heartbeat", reading, now, nil))
	}

	t.last = reading
	if len(out) > 0 {
		t.lastEventAt = now
	}
	return out
}

func (t *Tracker) alarmEvent(reading *mtconnect.Reading, ts time.Time) Event {
	ev := t.event("alarm", reading, ts, nil)
	active := reading.AlarmActive
	ev.AlarmActive = &active
	if reading.AlarmCode != "" {
		code := reading.AlarmCode
		ev.AlarmCode = &code
	}
	return ev
}

func (t *Tracker) event(eventType string, reading *mtconnect.Reading, ts time.Time, prev *string) Event {
	active := reading.AlarmActive
	return Event{
		Schema:          Schema,
		PlantID:         t.PlantID,
		SourceSystem:    SourceSystem,
		MachineID:       t.Machine.AssetID,
		MachineSerial:   nonempty(t.Machine.MachineSerial),
		ControllerMake:  nonempty(t.Machine.ControllerMake),
		ControllerModel: nonempty(t.Machine.ControllerModel),
		CapturePath:     CapturePath,
		EventType:       eventType,
		TsUTC:           ts.UTC().Format(time.RFC3339),
		State:           reading.State,
		PrevState:       prev,
		ProgramName:     nonempty(reading.ProgramName),
		PartID:          nil,
		JobID:           nil,
		CycleSeq:        reading.PartCount,
		RuntimeCuttingS: reading.CuttingTimeS,
		SpindleOnS:      reading.SpindleOnS,
		GapClass:        nil,
		AlarmCode:       nonempty(reading.AlarmCode),
		AlarmActive:     &active,
		ControlMode:     reading.ControlMode,
		Quality:         &Quality{SourceOK: true, Notes: nil},
	}
}

func nonempty(s string) *string {
	s = strings.TrimSpace(s)
	if s == "" {
		return nil
	}
	return &s
}

func parseTS(raw string, fallback time.Time) time.Time {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return fallback.UTC()
	}
	if t, err := time.Parse(time.RFC3339Nano, raw); err == nil {
		return t.UTC()
	}
	if t, err := time.Parse(time.RFC3339, raw); err == nil {
		return t.UTC()
	}
	return fallback.UTC()
}
