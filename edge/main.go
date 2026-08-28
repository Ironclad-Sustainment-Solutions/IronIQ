// Command ironiq-edge is the on-prem IronIQ Edge agent. It lives on the
// shop LAN, READ-ONLY polls Haas NGC MTConnect, and POSTs iss.machine_event.v1
// to POST /api/ironiq/v1/machine-events with a per-facility ingest key.
//
// It is not a cloud service. It never writes a CNC. IronIQ never talks to
// a CNC. The CNC does not need internet.
package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"os"
	"time"

	"ironiq-edge/buffer"
	"ironiq-edge/ingest"
)

func main() {
	configPath := flag.String("config", envOr("IRONIQ_EDGE_CONFIG", "edge.config.json"), "path to JSON config (machines + IronIQ URL)")
	flag.Parse()

	cfg, err := loadConfig(*configPath)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}

	queue, err := buffer.Open(cfg.BufferPath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "open buffer: %v\n", err)
		os.Exit(1)
	}

	client := ingest.New(cfg.IronIQURL, cfg.FacilityKey, nil)
	a := newAgent(cfg, queue, client, nil)

	log.SetFlags(0)
	log.Println("IronIQ Edge starting (on-prem, read-only to CNC).")
	log.Printf("  IronIQ: %s%s", cfg.IronIQURL, ingest.Path)
	log.Printf("  Plant: %s  machines: %d  poll: %s", cfg.PlantID, len(cfg.Machines), cfg.pollInterval())
	log.Println("  CNC stays off the internet. This process only GET /current on the LAN and POSTs outbound to IronIQ.")
	log.Println("")

	ctx := context.Background()
	a.tick(ctx)
	ticker := time.NewTicker(cfg.pollInterval())
	defer ticker.Stop()
	for range ticker.C {
		a.tick(ctx)
	}
}
