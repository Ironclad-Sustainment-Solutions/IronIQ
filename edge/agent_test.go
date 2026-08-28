package main

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"ironiq-edge/buffer"
	"ironiq-edge/ingest"
	"ironiq-edge/mapper"
)

func TestTickMockXMLPostsV1WithFacilityBearer(t *testing.T) {
	xml, err := os.ReadFile("testdata/haas_current_running.xml")
	if err != nil {
		t.Fatal(err)
	}

	var mtMethods []string
	mtc := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		mtMethods = append(mtMethods, r.Method)
		if r.Method != http.MethodGet {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		w.Write(xml)
	}))
	defer mtc.Close()

	type captured struct {
		auth, path, query, body string
		status                  int
	}
	var got captured
	status := http.StatusAccepted
	ironiq := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		raw, _ := io.ReadAll(r.Body)
		got = captured{
			auth:   r.Header.Get("Authorization"),
			path:   r.URL.Path,
			query:  r.URL.RawQuery,
			body:   string(raw),
			status: status,
		}
		w.WriteHeader(status)
	}))
	defer ironiq.Close()

	key := "facility-ingest-key"
	q, err := buffer.Open(filepath.Join(t.TempDir(), "buf.json"))
	if err != nil {
		t.Fatal(err)
	}
	cfg := Config{
		IronIQURL:   ironiq.URL,
		FacilityKey: key,
		PlantID:     "shop-south",
		Machines: []machineConfig{{
			AssetID:         "MC-UMC750-01",
			MTConnectURL:    mtc.URL,
			ControllerMake:  "Haas",
			ControllerModel: "UMC-750",
		}},
	}
	a := newAgent(cfg, q, ingest.New(ironiq.URL, key, ironiq.Client()), mtc.Client())
	a.now = func() time.Time { return time.Date(2026, 8, 27, 14, 32, 1, 0, time.UTC) }
	a.tick(context.Background())

	if len(mtMethods) != 1 || mtMethods[0] != http.MethodGet {
		t.Fatalf("CNC must only see GET, got %v", mtMethods)
	}
	if got.path != "/api/ironiq/v1/machine-events" {
		t.Fatalf("path %s", got.path)
	}
	if got.query != "" {
		t.Fatalf("query %s", got.query)
	}
	if got.auth != "Bearer "+key {
		t.Fatalf("auth %q", got.auth)
	}
	if strings.Contains(got.auth, "wrong-key") {
		t.Fatal("wrong key sent as if valid")
	}
	var env struct {
		Events []mapper.Event `json:"events"`
	}
	if err := json.Unmarshal([]byte(got.body), &env); err != nil {
		t.Fatal(err)
	}
	if len(env.Events) != 1 {
		t.Fatalf("events %+v", env.Events)
	}
	ev := env.Events[0]
	if ev.EventType != "state_change" || ev.State != "RUNNING" || ev.CapturePath != "mtconnect" {
		t.Fatalf("%+v", ev)
	}
	if ev.ProgramName == nil || *ev.ProgramName != "O5123" {
		t.Fatalf("program %+v", ev.ProgramName)
	}
	if ev.ControlMode == nil || *ev.ControlMode != "AUTO" {
		t.Fatalf("mode %+v", ev.ControlMode)
	}
	if q.Len() != 0 {
		t.Fatal("successful post should drain buffer")
	}
}

func TestBufferRetries5xxNot400(t *testing.T) {
	xml, err := os.ReadFile("testdata/haas_current_running.xml")
	if err != nil {
		t.Fatal(err)
	}
	mtc := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Write(xml)
	}))
	defer mtc.Close()

	var calls int
	var codes []int
	ironiq := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		if calls == 1 {
			codes = append(codes, 500)
			w.WriteHeader(500)
			return
		}
		if calls == 2 {
			codes = append(codes, 400)
			w.WriteHeader(400)
			return
		}
		w.WriteHeader(202)
	}))
	defer ironiq.Close()

	q, err := buffer.Open(filepath.Join(t.TempDir(), "buf.json"))
	if err != nil {
		t.Fatal(err)
	}
	cfg := Config{
		IronIQURL:   ironiq.URL,
		FacilityKey: "k",
		PlantID:     "shop-south",
		Machines: []machineConfig{{
			AssetID:      "MC-UMC750-01",
			MTConnectURL: mtc.URL,
		}},
	}
	a := newAgent(cfg, q, ingest.New(ironiq.URL, "k", ironiq.Client()), mtc.Client())
	a.now = func() time.Time { return time.Date(2026, 8, 27, 14, 32, 1, 0, time.UTC) }

	a.tick(context.Background())
	if q.Len() != 1 {
		t.Fatalf("5xx should keep buffer, len=%d", q.Len())
	}

	a.flush(context.Background())
	if q.Len() != 0 {
		t.Fatalf("400 should drop, not retry forever, len=%d", q.Len())
	}
	if len(codes) < 2 || codes[0] != 500 || codes[1] != 400 {
		t.Fatalf("codes %v", codes)
	}
}

func TestConfigRejectsMissingFacilityKey(t *testing.T) {
	cfg := Config{
		IronIQURL: "https://example",
		PlantID:   "p",
		Machines:  []machineConfig{{AssetID: "M1", MTConnectURL: "http://10.0.0.1:8082"}},
	}
	if err := cfg.validate(); err == nil || !strings.Contains(err.Error(), "facility_key") {
		t.Fatalf("expected facility key required, got %v", err)
	}
}
