package mtconnect_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"runtime"
	"testing"

	"ironiq-edge/mtconnect"
)

func testdata(t *testing.T, name string) []byte {
	t.Helper()
	_, file, _, _ := runtime.Caller(0)
	path := filepath.Join(filepath.Dir(file), "..", "testdata", name)
	raw, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	return raw
}

func TestParseHaasCurrentMapsV1Fields(t *testing.T) {
	reading, err := mtconnect.ParseCurrent(testdata(t, "haas_current_running.xml"), "")
	if err != nil {
		t.Fatal(err)
	}
	if reading.State != "RUNNING" {
		t.Fatalf("state=%s", reading.State)
	}
	if reading.ProgramName != "O5123" {
		t.Fatalf("program=%s", reading.ProgramName)
	}
	if reading.PartCount == nil || *reading.PartCount != 41 {
		t.Fatalf("partCount=%v", reading.PartCount)
	}
	if reading.ControlMode == nil || *reading.ControlMode != "AUTO" {
		t.Fatalf("control_mode=%v", reading.ControlMode)
	}
	if reading.AlarmActive {
		t.Fatal("expected no alarm")
	}
	if reading.DeviceName != "HaasNGC" {
		t.Fatalf("device=%s", reading.DeviceName)
	}
}

func TestParseHaasIdleAndJog(t *testing.T) {
	reading, err := mtconnect.ParseCurrent(testdata(t, "haas_current_idle_jog.xml"), "HaasNGC")
	if err != nil {
		t.Fatal(err)
	}
	if reading.State != "IDLE" {
		t.Fatalf("state=%s", reading.State)
	}
	if reading.ControlMode == nil || *reading.ControlMode != "JOG" {
		t.Fatalf("control_mode=%v", reading.ControlMode)
	}
}

func TestParseHaasAlarmAndEstop(t *testing.T) {
	reading, err := mtconnect.ParseCurrent(testdata(t, "haas_current_alarm.xml"), "")
	if err != nil {
		t.Fatal(err)
	}
	if reading.State != "DOWN" {
		t.Fatalf("state=%s", reading.State)
	}
	if !reading.AlarmActive || reading.AlarmCode != "ESTOP" {
		t.Fatalf("alarm=%v %s", reading.AlarmActive, reading.AlarmCode)
	}
}

func TestParseControlModeMDI(t *testing.T) {
	reading, err := mtconnect.ParseCurrent(testdata(t, "haas_current_mdi.xml"), "")
	if err != nil {
		t.Fatal(err)
	}
	if reading.ControlMode == nil || *reading.ControlMode != "MDI" {
		t.Fatalf("control_mode=%v", reading.ControlMode)
	}
}

func TestCurrentHTTPIsGetOnly(t *testing.T) {
	var methods []string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		methods = append(methods, r.Method+" "+r.URL.Path)
		if r.Method != http.MethodGet {
			t.Errorf("CNC write attempted: %s %s", r.Method, r.URL.Path)
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		if r.URL.Path != "/current" {
			w.WriteHeader(http.StatusNotFound)
			return
		}
		w.Write(testdata(t, "haas_current_running.xml"))
	}))
	defer srv.Close()

	reading, err := mtconnect.Current(context.Background(), srv.Client(), srv.URL, "")
	if err != nil {
		t.Fatal(err)
	}
	if reading.State != "RUNNING" {
		t.Fatalf("state=%s", reading.State)
	}
	if len(methods) != 1 || methods[0] != "GET /current" {
		t.Fatalf("methods=%v", methods)
	}
}

func TestProbe(t *testing.T) {
	devices, err := mtconnect.ParseProbe(testdata(t, "haas_probe.xml"))
	if err != nil {
		t.Fatal(err)
	}
	if len(devices) != 1 || devices[0].Name != "HaasNGC" {
		t.Fatalf("%+v", devices)
	}
}
