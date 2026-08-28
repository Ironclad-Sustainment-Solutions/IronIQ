// Command mtconnect-bridge polls a local MTConnect agent and pushes
// readings outbound to IronIQ. Runs on any PC on the same local network
// as the MTConnect agent -- NOT on IronIQ's cloud servers, which can't
// reach a private LAN address on a customer's network at all.
//
// Deliberately minimal footprint:
//   - Never opens a port. Only ever makes outbound HTTP requests: one to
//     the local MTConnect agent, one to IronIQ's cloud ingest endpoint.
//     Outbound HTTPS like this is essentially always allowed through any
//     corporate firewall, the same way regular web browsing is.
//   - No runtime to install. Compiled to a single, dependency-free
//     native binary (Go's standard toolchain, no external packages at
//     all -- see go.mod) -- copy the one file to any Windows, macOS, or
//     Linux machine and run it. Nothing else to install.
//   - No background service required. Run it in a terminal, or wire it
//     into Task Scheduler / cron / systemd yourself if you want it to
//     survive reboots -- that's your choice, not a requirement of the
//     agent itself.
package main

import (
	"bytes"
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"ironiq-mtconnect-bridge/mtconnect"
)

type config struct {
	agentURL   string
	device     string
	machineID  string
	apiKey     string
	ingestURL  string
	interval   time.Duration
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func readConfig() (config, error) {
	agentURL := flag.String("agent-url", envOr("MTCONNECT_BRIDGE_AGENT_URL", ""), "MTConnect agent base URL, e.g. http://192.168.1.50:5000")
	device := flag.String("device", envOr("MTCONNECT_BRIDGE_DEVICE", ""), "device name (optional -- leave blank if the agent only serves one device)")
	machineID := flag.String("machine-id", envOr("MTCONNECT_BRIDGE_MACHINE_ID", ""), "IronIQ machine id")
	apiKey := flag.String("api-key", envOr("MTCONNECT_BRIDGE_API_KEY", ""), "bridge API key, generated from the machine's detail page in IronIQ")
	ingestURL := flag.String("ingest-url", envOr("MTCONNECT_BRIDGE_INGEST_URL", ""), "IronIQ ingest endpoint URL")
	intervalSec := flag.Int("interval", 30, "poll interval in seconds")
	flag.Parse()

	var missing []string
	if *agentURL == "" {
		missing = append(missing, "--agent-url")
	}
	if *machineID == "" {
		missing = append(missing, "--machine-id")
	}
	if *apiKey == "" {
		missing = append(missing, "--api-key")
	}
	if *ingestURL == "" {
		missing = append(missing, "--ingest-url")
	}
	if len(missing) > 0 {
		return config{}, fmt.Errorf(
			"missing required config: %s\nUsage: mtconnect-bridge --agent-url <url> --machine-id <id> --api-key <key> --ingest-url <url> [--device <name>] [--interval <seconds>]",
			strings.Join(missing, ", "),
		)
	}

	return config{
		agentURL:  *agentURL,
		device:    *device,
		machineID: *machineID,
		apiKey:    *apiKey,
		ingestURL: *ingestURL,
		interval:  time.Duration(*intervalSec) * time.Second,
	}, nil
}

type ingestResult struct {
	RecordedRunEvent  bool    `json:"recordedRunEvent"`
	AttributedMinutes float64 `json:"attributedMinutes"`
	CyclesDelta       float64 `json:"cyclesDelta"`
}

func pushReading(ctx context.Context, cfg config, reading *mtconnect.CurrentReading) (*ingestResult, error) {
	body := map[string]any{
		"deviceName":   reading.DeviceName,
		"timestamp":    reading.Timestamp,
		"state":        reading.State,
		"rawExecution": nullableString(reading.RawExecution),
		"partCount":    reading.PartCount,
		"partNumber":   nullableString(reading.PartNumber),
	}
	if reading.Sequence != nil {
		body["sequence"] = *reading.Sequence
	}
	payload, err := json.Marshal(body)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, cfg.ingestURL, bytes.NewReader(payload))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+cfg.apiKey)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("could not reach IronIQ ingest endpoint: %w", err)
	}
	defer resp.Body.Close()
	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("ingest endpoint returned HTTP %d: %s", resp.StatusCode, truncate(string(respBody), 300))
	}
	var result ingestResult
	if err := json.Unmarshal(respBody, &result); err != nil {
		return nil, fmt.Errorf("ingest endpoint returned an unexpected response: %w", err)
	}
	return &result, nil
}

func nullableString(s string) any {
	if s == "" {
		return nil
	}
	return s
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n]
}

func tick(cfg config) {
	ts := time.Now().Format(time.RFC3339)
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	reading, err := mtconnect.Current(ctx, cfg.agentURL, cfg.device)
	if err != nil {
		log.Printf("[%s] FAILED -- %v", ts, err)
		return
	}
	result, err := pushReading(ctx, cfg, reading)
	if err != nil {
		log.Printf("[%s] FAILED -- %v", ts, err)
		return
	}

	execution := reading.RawExecution
	if execution == "" {
		execution = "n/a"
	}
	partCount := "n/a"
	if reading.PartCount != nil {
		partCount = fmt.Sprintf("%.0f", *reading.PartCount)
	}
	suffix := "-- baseline established"
	if result.RecordedRunEvent {
		suffix = fmt.Sprintf("-- logged +%.0f parts, %.0f min", result.CyclesDelta, result.AttributedMinutes)
	}
	log.Printf("[%s] OK -- %s (execution=%s, partCount=%s) %s", ts, reading.State, execution, partCount, suffix)
}

func main() {
	cfg, err := readConfig()
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}

	log.SetFlags(0)
	log.Println("MTConnect bridge agent starting.")
	deviceNote := ""
	if cfg.device != "" {
		deviceNote = fmt.Sprintf(" (device: %s)", cfg.device)
	}
	log.Printf("  Polling %s%s every %s", cfg.agentURL, deviceNote, cfg.interval)
	log.Printf("  Pushing to %s", cfg.ingestURL)
	log.Printf("  Machine id: %s", cfg.machineID)
	log.Println("")

	// Run once immediately, then on the configured interval. No open
	// ports, no persistent connections held open between ticks -- just a
	// plain poll loop making outbound HTTP requests.
	tick(cfg)
	ticker := time.NewTicker(cfg.interval)
	defer ticker.Stop()
	for range ticker.C {
		tick(cfg)
	}
}
