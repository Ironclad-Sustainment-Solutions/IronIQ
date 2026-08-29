package main

import (
	"strings"
	"testing"
)

func baseConfig(machines ...machineConfig) Config {
	return Config{
		IronIQURL:   "https://ironiq.test",
		FacilityKey: "test-key",
		PlantID:     "test-plant",
		Machines:    machines,
	}
}

func TestProtocolDefaultsToMTConnect(t *testing.T) {
	m := machineConfig{AssetID: "M1", MTConnectURL: "http://10.0.0.1:8082"}
	if got := m.protocol(); got != "mtconnect" {
		t.Fatalf("expected empty Protocol to default to mtconnect, got %q", got)
	}
}

func TestValidate_MTConnectMachineRequiresURL(t *testing.T) {
	cfg := baseConfig(machineConfig{AssetID: "M1"})
	err := cfg.validate()
	if err == nil || !strings.Contains(err.Error(), "mtconnect_url") {
		t.Fatalf("expected a missing mtconnect_url error, got %v", err)
	}
}

func TestValidate_FocasMachineRequiresHostAndPort(t *testing.T) {
	cfg := baseConfig(machineConfig{AssetID: "M1", Protocol: "focas"})
	err := cfg.validate()
	if err == nil {
		t.Fatal("expected an error for a focas machine missing host/port")
	}
	if !strings.Contains(err.Error(), "focas_host") || !strings.Contains(err.Error(), "focas_port") {
		t.Fatalf("expected both focas_host and focas_port flagged as missing, got %v", err)
	}
}

func TestValidate_FocasMachineWithHostAndPortIsValid(t *testing.T) {
	cfg := baseConfig(machineConfig{
		AssetID:   "M1",
		Protocol:  "focas",
		FocasHost: "10.0.0.9",
		FocasPort: 8193,
	})
	if err := cfg.validate(); err != nil {
		t.Fatalf("expected a fully-configured focas machine to validate cleanly, got %v", err)
	}
}

func TestValidate_UnknownProtocolIsRejected(t *testing.T) {
	cfg := baseConfig(machineConfig{AssetID: "M1", Protocol: "opcua"})
	err := cfg.validate()
	if err == nil || !strings.Contains(err.Error(), "unknown protocol") {
		t.Fatalf("expected an unknown-protocol error, got %v", err)
	}
}

func TestValidate_MixedFleetOfHaasAndFanucIsValid(t *testing.T) {
	// The real-world case this whole feature exists for: one config
	// with both a Haas (MTConnect) and a Fanuc (FOCAS) machine.
	cfg := baseConfig(
		machineConfig{AssetID: "HAAS-1", MTConnectURL: "http://10.0.0.1:8082"},
		machineConfig{AssetID: "FANUC-1", Protocol: "focas", FocasHost: "10.0.0.2", FocasPort: 8193},
	)
	if err := cfg.validate(); err != nil {
		t.Fatalf("expected a mixed Haas+Fanuc fleet to validate cleanly, got %v", err)
	}
}
