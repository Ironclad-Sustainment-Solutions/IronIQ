package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
)

// remoteMachine mirrors the JSON shape returned by GET
// /api/ironiq/v1/edge-config (see edge-machine-config.server.ts) --
// kept as its own type rather than reusing machineConfig directly since
// the wire format (protocol values "mtconnect"/"focas", no
// device_name/controller_model/machine_serial fields at all) isn't
// identical to the local config file's shape.
type remoteMachine struct {
	AssetID        string `json:"asset_id"`
	Protocol       string `json:"protocol"`
	MTConnectURL   string `json:"mtconnect_url"`
	FocasHost      string `json:"focas_host"`
	FocasPort      int    `json:"focas_port"`
	ControllerMake string `json:"controller_make"`
}

type remoteConfigResponse struct {
	Machines []remoteMachine `json:"machines"`
}

// fetchMachinesFromIronIQ calls IronIQ's own edge-config endpoint,
// authenticated with the same facility key already used for posting
// events -- one credential, one facility, same as everywhere else in
// this agent. Returns the current machine list as real machineConfig
// entries, ready to use exactly the way a local config file's
// `machines` array already is.
func fetchMachinesFromIronIQ(
	ctx context.Context,
	client *http.Client,
	ironiqURL string,
	facilityKey string,
) ([]machineConfig, error) {
	url := strings.TrimRight(ironiqURL, "/") + "/api/ironiq/v1/edge-config"
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("build edge-config request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+facilityKey)

	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("fetch edge-config: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read edge-config response: %w", err)
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("edge-config request failed: HTTP %d: %s", resp.StatusCode, string(body))
	}

	var parsed remoteConfigResponse
	if err := json.Unmarshal(body, &parsed); err != nil {
		return nil, fmt.Errorf("parse edge-config response: %w", err)
	}

	machines := make([]machineConfig, 0, len(parsed.Machines))
	for _, m := range parsed.Machines {
		machines = append(machines, machineConfig{
			AssetID:        m.AssetID,
			Protocol:       m.Protocol,
			MTConnectURL:   m.MTConnectURL,
			FocasHost:      m.FocasHost,
			FocasPort:      m.FocasPort,
			ControllerMake: m.ControllerMake,
		})
	}
	return machines, nil
}
