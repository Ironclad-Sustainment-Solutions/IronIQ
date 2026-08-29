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
}

func newAgent(cfg Config, queue *buffer.Queue, ingestClient *ingest.Client, mtc *http.Client) *agent {
	if mtc == nil {
		mtc = &http.Client{Timeout: 10 * time.Second}
	}
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
	return &agent{
		cfg:      cfg,
		mtc:      mtc,
		ingest:   ingestClient,
		queue:    queue,
		trackers: trackers,
		now:      func() time.Time { return time.Now().UTC() },
	}
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
