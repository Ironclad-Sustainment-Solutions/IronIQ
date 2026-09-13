package main

import (
	"context"
	"log"
	"net/http"
	"time"

	"ironiq-edge/buffer"
	"ironiq-edge/focas"
	"ironiq-edge/ingest"
	"ironiq-edge/mapper"
	"ironiq-edge/mtconnect"
	"ironiq-edge/reading"
)

type agent struct {
	cfg      Config
	mtc      *http.Client
	ingest   *ingest.Client
	queue    *buffer.Queue
	trackers map[string]*mapper.Tracker
	now      func() time.Time
	// True when the config file's own machines[] was empty at startup --
	// means "fetch the current list from IronIQ" rather than "this
	// facility genuinely has zero machines." Tracked so refreshMachines
	// knows whether it should be doing anything at all; a config that
	// explicitly lists machines locally is left alone, never silently
	// overwritten by whatever IronIQ happens to return.
	dynamic bool
}

func newAgent(cfg Config, queue *buffer.Queue, ingestClient *ingest.Client, mtc *http.Client) *agent {
	if mtc == nil {
		mtc = &http.Client{Timeout: 10 * time.Second}
	}
	a := &agent{
		cfg:     cfg,
		mtc:     mtc,
		ingest:  ingestClient,
		queue:   queue,
		now:     func() time.Time { return time.Now().UTC() },
		dynamic: len(cfg.Machines) == 0,
	}
	a.trackers = buildTrackers(cfg)
	return a
}

func buildTrackers(cfg Config) map[string]*mapper.Tracker {
	trackers := make(map[string]*mapper.Tracker, len(cfg.Machines))
	for _, m := range cfg.Machines {
		trackers[m.AssetID] = &mapper.Tracker{
			PlantID: cfg.PlantID,
			Machine: mapper.Machine{
				AssetID:         m.AssetID,
				ControllerMake:  m.ControllerMake,
				ControllerModel: m.ControllerModel,
				MachineSerial:   m.MachineSerial,
			},
		}
	}
	return trackers
}

// refreshMachines re-fetches the machine list from IronIQ when running
// in dynamic mode (see the dynamic field above) and merges it in --
// existing trackers for machines that are still present are kept
// exactly as they are (a tracker holds real state, like "what execution
// mode did this machine last report," that a routine refresh has no
// reason to discard), trackers for machines no longer returned are
// dropped, and new machines get a fresh tracker. A failed fetch (network
// hiccup, IronIQ briefly unreachable) is logged and otherwise ignored --
// the agent keeps polling with whatever machine list it already has
// rather than losing all of them over one bad request.
func (a *agent) refreshMachines(ctx context.Context) {
	if !a.dynamic {
		return
	}
	machines, err := fetchMachinesFromIronIQ(ctx, a.mtc, a.cfg.IronIQURL, a.cfg.FacilityKey)
	if err != nil {
		log.Printf("refresh machine list: %v (keeping the last known list)", err)
		return
	}
	a.cfg.Machines = machines
	next := buildTrackers(a.cfg)
	for assetID, tracker := range a.trackers {
		if _, stillPresent := next[assetID]; stillPresent {
			next[assetID] = tracker
		}
	}
	a.trackers = next
	log.Printf("refreshed machine list from IronIQ: %d machine(s)", len(machines))
}

func (a *agent) tick(ctx context.Context) {
	for _, m := range a.cfg.Machines {
		var snapshot *reading.Reading
		var err error
		switch m.protocol() {
		case "focas":
			snapshot, err = focas.Current(ctx, m.FocasHost, m.FocasPort)
		default: // "mtconnect", and the empty-string default from protocol()
			snapshot, err = mtconnect.Current(ctx, a.mtc, m.MTConnectURL, m.DeviceName)
		}
		if err != nil {
			log.Printf("%s %s: %v", m.protocol(), m.AssetID, err)
			continue
		}
		events := a.trackers[m.AssetID].Next(snapshot, a.now())
		if len(events) == 0 {
			continue
		}
		if _, err := a.queue.Enqueue(events); err != nil {
			log.Printf("buffer enqueue %s: %v", m.AssetID, err)
		}
	}
	a.flush(ctx)
}

func (a *agent) flush(ctx context.Context) {
	for _, item := range a.queue.Pending() {
		res := a.ingest.Post(ctx, item.Events)
		switch res.Outcome {
		case ingest.OK:
			if err := a.queue.Drop(item.ID); err != nil {
				log.Printf("buffer drop: %v", err)
			} else {
				log.Printf("posted %d event(s) HTTP %d", len(item.Events), res.StatusCode)
			}
		case ingest.Drop:
			log.Printf("ingest rejected (not retried): %v", res.Err)
			if err := a.queue.Drop(item.ID); err != nil {
				log.Printf("buffer drop: %v", err)
			}
		case ingest.Retry:
			log.Printf("ingest retryable: %v", res.Err)
			if err := a.queue.MarkRetry(item.ID); err != nil {
				log.Printf("buffer retry: %v", err)
			}
		}
	}
}
