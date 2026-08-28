package main

import (
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"time"
)

type machineConfig struct {
	AssetID         string `json:"asset_id"`
	MTConnectURL    string `json:"mtconnect_url"`
	DeviceName      string `json:"device_name"`
	ControllerMake  string `json:"controller_make"`
	ControllerModel string `json:"controller_model"`
	MachineSerial   string `json:"machine_serial"`
}

type Config struct {
	IronIQURL     string          `json:"ironiq_url"`
	FacilityKey   string          `json:"facility_key"`
	PlantID       string          `json:"plant_id"`
	PollIntervalS int             `json:"poll_interval_s"`
	HeartbeatS    int             `json:"heartbeat_s"`
	BufferPath    string          `json:"buffer_path"`
	Machines      []machineConfig `json:"machines"`
}

func envOr(key, fallback string) string {
	if v := strings.TrimSpace(os.Getenv(key)); v != "" {
		return v
	}
	return fallback
}

func loadConfig(path string) (Config, error) {
	cfg := Config{
		PollIntervalS: 5,
		HeartbeatS:    60,
		BufferPath:    "edge-buffer.json",
	}
	if path != "" {
		raw, err := os.ReadFile(path)
		if err != nil {
			return Config{}, fmt.Errorf("read config %s: %w", path, err)
		}
		if err := json.Unmarshal(raw, &cfg); err != nil {
			return Config{}, fmt.Errorf("parse config %s: %w", path, err)
		}
	}
	if v := envOr("IRONIQ_URL", ""); v != "" {
		cfg.IronIQURL = v
	}
	if v := envOr("IRONIQ_FACILITY_KEY", ""); v != "" {
		cfg.FacilityKey = v
	}
	if v := envOr("IRONIQ_PLANT_ID", ""); v != "" {
		cfg.PlantID = v
	}
	if cfg.PollIntervalS <= 0 {
		cfg.PollIntervalS = 5
	}
	if cfg.HeartbeatS <= 0 {
		cfg.HeartbeatS = 60
	}
	if cfg.BufferPath == "" {
		cfg.BufferPath = "edge-buffer.json"
	}
	return cfg, cfg.validate()
}

func (c Config) validate() error {
	var missing []string
	if strings.TrimSpace(c.IronIQURL) == "" {
		missing = append(missing, "ironiq_url (or IRONIQ_URL)")
	}
	if strings.TrimSpace(c.FacilityKey) == "" {
		missing = append(missing, "facility_key (or IRONIQ_FACILITY_KEY)")
	}
	if strings.TrimSpace(c.PlantID) == "" {
		missing = append(missing, "plant_id (or IRONIQ_PLANT_ID)")
	}
	if len(c.Machines) == 0 {
		missing = append(missing, "machines[]")
	}
	for i, m := range c.Machines {
		if strings.TrimSpace(m.AssetID) == "" {
			missing = append(missing, fmt.Sprintf("machines[%d].asset_id", i))
		}
		if strings.TrimSpace(m.MTConnectURL) == "" {
			missing = append(missing, fmt.Sprintf("machines[%d].mtconnect_url", i))
		}
	}
	if len(missing) > 0 {
		return fmt.Errorf("missing required config: %s", strings.Join(missing, ", "))
	}
	return nil
}

func (c Config) pollInterval() time.Duration {
	return time.Duration(c.PollIntervalS) * time.Second
}
