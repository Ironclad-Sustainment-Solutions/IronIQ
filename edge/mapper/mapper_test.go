package mapper_test

import (
	"os"
	"path/filepath"
	"runtime"
	"testing"
	"time"

	"ironiq-edge/mapper"
	"ironiq-edge/mtconnect"
)

func testdata(t *testing.T, name string) []byte {
	t.Helper()
	_, file, _, _ := runtime.Caller(0)
	raw, err := os.ReadFile(filepath.Join(filepath.Dir(file), "..", "testdata", name))
	if err != nil {
		t.Fatal(err)
	}
	return raw
}

func parse(t *testing.T, name string) *mtconnect.Reading {
	t.Helper()
	r, err := mtconnect.ParseCurrent(testdata(t, name), "")
	if err != nil {
		t.Fatal(err)
	}
	return r
}

func tracker() *mapper.Tracker {
	return &mapper.Tracker{
		PlantID: "shop-south",
		Machine: mapper.Machine{
			AssetID:         "MC-UMC750-01",
			ControllerMake:  "Haas",
			ControllerModel: "UMC-750",
		},
	}
}

func TestMockXMLToV1Events(t *testing.T) {
	tr := tracker()
	now := time.Date(2026, 8, 27, 14, 32, 1, 0, time.UTC)

	first := tr.Next(parse(t, "haas_current_running.xml"), now)
	if len(first) != 1 || first[0].EventType != "state_change" {
		t.Fatalf("first=%+v", first)
	}
	ev := first[0]
	if ev.Schema != "iss.machine_event.v1" || ev.CapturePath != "mtconnect" {
		t.Fatalf("schema/path %+v", ev)
	}
	if ev.State != "RUNNING" || ev.MachineID != "MC-UMC750-01" {
		t.Fatalf("state/machine %+v", ev)
	}
	if ev.ProgramName == nil || *ev.ProgramName != "O5123" {
		t.Fatalf("program %+v", ev.ProgramName)
	}
	if ev.CycleSeq == nil || *ev.CycleSeq != 41 {
		t.Fatalf("cycle_seq %+v", ev.CycleSeq)
	}
	if ev.ControlMode == nil || *ev.ControlMode != "AUTO" {
		t.Fatalf("control_mode %+v", ev.ControlMode)
	}
	if ev.SourceSystem != "ironiq-edge" {
		t.Fatalf("source %s", ev.SourceSystem)
	}
	if ev.GapClass != nil {
		t.Fatalf("edge must not invent gap_class, got %v", *ev.GapClass)
	}

	later := now.Add(70 * time.Second)
	cycle := tr.Next(parse(t, "haas_current_cycle_end.xml"), later)
	if len(cycle) != 2 {
		t.Fatalf("expected state_change+cycle_end, got %+v", types(cycle))
	}
	if cycle[0].EventType != "state_change" || cycle[0].State != "IDLE" {
		t.Fatalf("state_change %+v", cycle[0])
	}
	if cycle[0].PrevState == nil || *cycle[0].PrevState != "RUNNING" {
		t.Fatalf("prev_state %+v", cycle[0].PrevState)
	}
	if cycle[1].EventType != "cycle_end" || cycle[1].CycleSeq == nil || *cycle[1].CycleSeq != 42 {
		t.Fatalf("cycle_end %+v", cycle[1])
	}
}

func TestHeartbeatAfter60sWithoutOtherEvents(t *testing.T) {
	tr := tracker()
	now := time.Date(2026, 8, 27, 14, 32, 1, 0, time.UTC)
	_ = tr.Next(parse(t, "haas_current_running.xml"), now)

	still := tr.Next(parse(t, "haas_current_running.xml"), now.Add(30*time.Second))
	if len(still) != 0 {
		t.Fatalf("no event before 60s, got %+v", types(still))
	}

	beat := tr.Next(parse(t, "haas_current_running.xml"), now.Add(60*time.Second))
	if len(beat) != 1 || beat[0].EventType != "heartbeat" {
		t.Fatalf("heartbeat %+v", types(beat))
	}
	if beat[0].State != "RUNNING" {
		t.Fatalf("heartbeat state %s", beat[0].State)
	}
}

func TestAlarmEvent(t *testing.T) {
	tr := tracker()
	now := time.Date(2026, 8, 27, 14, 32, 1, 0, time.UTC)
	_ = tr.Next(parse(t, "haas_current_running.xml"), now)
	out := tr.Next(parse(t, "haas_current_alarm.xml"), now.Add(time.Second))
	found := false
	for _, ev := range out {
		if ev.EventType == "alarm" {
			found = true
			if ev.AlarmCode == nil || *ev.AlarmCode != "ESTOP" {
				t.Fatalf("alarm code %+v", ev.AlarmCode)
			}
			if ev.AlarmActive == nil || !*ev.AlarmActive {
				t.Fatal("alarm_active")
			}
			if ev.State != "DOWN" {
				t.Fatalf("alarm state %s", ev.State)
			}
		}
	}
	if !found {
		t.Fatalf("missing alarm in %+v", types(out))
	}
}

func types(events []mapper.Event) []string {
	out := make([]string, len(events))
	for i, e := range events {
		out[i] = e.EventType
	}
	return out
}
