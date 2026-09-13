package main

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"ironiq-edge/buffer"
	"ironiq-edge/ingest"
)

func newTestAgent(t *testing.T, cfg Config, edgeConfigURL string) *agent {
	t.Helper()
	if edgeConfigURL != "" {
		cfg.IronIQURL = edgeConfigURL
	}
	q, err := buffer.Open(filepath.Join(t.TempDir(), "buf.json"))
	if err != nil {
		t.Fatal(err)
	}
	client := ingest.New(cfg.IronIQURL, cfg.FacilityKey, nil)
	return newAgent(cfg, q, client, nil)
}

func TestRefreshMachines_StaticConfigNeverCallsIronIQ(t *testing.T) {
	// A config that already lists machines locally must never have that
	// list silently overwritten -- refreshMachines should be a genuine
	// no-op in that case, confirmed here by making the mock IronIQ
	// server fail the test outright if it's ever hit at all.
	called := false
	ironiq := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
		w.WriteHeader(http.StatusOK)
	}))
	defer ironiq.Close()

	cfg := Config{
		FacilityKey: "test-key",
		PlantID:     "shop-south",
		Machines:    []machineConfig{{AssetID: "M1", MTConnectURL: "http://example.test"}},
	}
	a := newTestAgent(t, cfg, ironiq.URL)
	a.refreshMachines(context.Background())

	if called {
		t.Fatal("refreshMachines called IronIQ even though this config has a static machines[] list")
	}
	if len(a.cfg.Machines) != 1 || a.cfg.Machines[0].AssetID != "M1" {
		t.Fatalf("static machine list was modified: %+v", a.cfg.Machines)
	}
}

func TestRefreshMachines_DynamicConfigFetchesAndPopulates(t *testing.T) {
	ironiq := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/ironiq/v1/edge-config" {
			t.Errorf("unexpected path: %s", r.URL.Path)
		}
		if got := r.Header.Get("Authorization"); got != "Bearer test-key" {
			t.Errorf("expected facility key as bearer token, got %q", got)
		}
		json.NewEncoder(w).Encode(remoteConfigResponse{
			Machines: []remoteMachine{
				{AssetID: "MC-01", Protocol: "mtconnect", MTConnectURL: "http://10.0.0.5:8082", ControllerMake: "Haas"},
				{AssetID: "MC-02", Protocol: "focas", FocasHost: "10.0.0.6", FocasPort: 8193, ControllerMake: "Fanuc"},
			},
		})
	}))
	defer ironiq.Close()

	cfg := Config{FacilityKey: "test-key", PlantID: "shop-south"} // empty machines[] -- dynamic mode
	a := newTestAgent(t, cfg, ironiq.URL)

	if !a.dynamic {
		t.Fatal("expected dynamic mode to be detected from an empty machines[]")
	}

	a.refreshMachines(context.Background())

	if len(a.cfg.Machines) != 2 {
		t.Fatalf("expected 2 machines fetched from IronIQ, got %d", len(a.cfg.Machines))
	}
	if _, ok := a.trackers["MC-01"]; !ok {
		t.Error("expected a tracker for MC-01 after refresh")
	}
	if _, ok := a.trackers["MC-02"]; !ok {
		t.Error("expected a tracker for MC-02 after refresh")
	}
}

func TestRefreshMachines_PreservesExistingTrackerState(t *testing.T) {
	// The real reason this isn't just "rebuild everything from scratch"
	// on every refresh: a tracker holds real accumulated state (last
	// known execution mode, etc.) that a routine list refresh has no
	// reason to discard for a machine that's still present.
	callCount := 0
	ironiq := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		callCount++
		json.NewEncoder(w).Encode(remoteConfigResponse{
			Machines: []remoteMachine{
				{AssetID: "MC-01", Protocol: "mtconnect", MTConnectURL: "http://10.0.0.5:8082"},
			},
		})
	}))
	defer ironiq.Close()

	cfg := Config{FacilityKey: "test-key", PlantID: "shop-south"}
	a := newTestAgent(t, cfg, ironiq.URL)

	a.refreshMachines(context.Background())
	firstTracker := a.trackers["MC-01"]
	if firstTracker == nil {
		t.Fatal("expected a tracker for MC-01 after the first refresh")
	}

	a.refreshMachines(context.Background())
	secondTracker := a.trackers["MC-01"]

	if firstTracker != secondTracker {
		t.Error("expected the SAME tracker instance to be kept across a refresh for a machine that's still present, got a new one")
	}
	if callCount != 2 {
		t.Fatalf("expected exactly 2 fetches (one per refreshMachines call), got %d", callCount)
	}
}

func TestRefreshMachines_DropsTrackerForRemovedMachine(t *testing.T) {
	first := true
	ironiq := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if first {
			json.NewEncoder(w).Encode(remoteConfigResponse{
				Machines: []remoteMachine{
					{AssetID: "MC-01", Protocol: "mtconnect", MTConnectURL: "http://10.0.0.5:8082"},
					{AssetID: "MC-02", Protocol: "mtconnect", MTConnectURL: "http://10.0.0.6:8082"},
				},
			})
			first = false
			return
		}
		// Second refresh: MC-02 has been removed/reconfigured away in IronIQ.
		json.NewEncoder(w).Encode(remoteConfigResponse{
			Machines: []remoteMachine{
				{AssetID: "MC-01", Protocol: "mtconnect", MTConnectURL: "http://10.0.0.5:8082"},
			},
		})
	}))
	defer ironiq.Close()

	cfg := Config{FacilityKey: "test-key", PlantID: "shop-south"}
	a := newTestAgent(t, cfg, ironiq.URL)

	a.refreshMachines(context.Background())
	if _, ok := a.trackers["MC-02"]; !ok {
		t.Fatal("expected a tracker for MC-02 after the first refresh")
	}

	a.refreshMachines(context.Background())
	if _, ok := a.trackers["MC-02"]; ok {
		t.Error("expected MC-02's tracker to be dropped after it disappeared from IronIQ's response")
	}
	if _, ok := a.trackers["MC-01"]; !ok {
		t.Error("expected MC-01's tracker to still be present")
	}
}

func TestRefreshMachines_FailedFetchKeepsLastKnownList(t *testing.T) {
	shouldFail := false
	ironiq := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if shouldFail {
			w.WriteHeader(http.StatusInternalServerError)
			return
		}
		json.NewEncoder(w).Encode(remoteConfigResponse{
			Machines: []remoteMachine{
				{AssetID: "MC-01", Protocol: "mtconnect", MTConnectURL: "http://10.0.0.5:8082"},
			},
		})
	}))
	defer ironiq.Close()

	cfg := Config{FacilityKey: "test-key", PlantID: "shop-south"}
	a := newTestAgent(t, cfg, ironiq.URL)

	a.refreshMachines(context.Background())
	if len(a.cfg.Machines) != 1 {
		t.Fatalf("expected 1 machine after the first successful refresh, got %d", len(a.cfg.Machines))
	}

	shouldFail = true
	a.refreshMachines(context.Background())

	if len(a.cfg.Machines) != 1 || a.cfg.Machines[0].AssetID != "MC-01" {
		t.Fatalf("expected the last known machine list to survive a failed refresh, got %+v", a.cfg.Machines)
	}
	if _, ok := a.trackers["MC-01"]; !ok {
		t.Error("expected MC-01's tracker to still be present after a failed refresh")
	}
}
