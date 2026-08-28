package buffer_test

import (
	"path/filepath"
	"testing"

	"ironiq-edge/buffer"
	"ironiq-edge/ingest"
	"ironiq-edge/mapper"
)

func TestDropOn400KeepOnRetry(t *testing.T) {
	dir := t.TempDir()
	q, err := buffer.Open(filepath.Join(dir, "buf.json"))
	if err != nil {
		t.Fatal(err)
	}
	ev := mapper.Event{
		Schema:       "iss.machine_event.v1",
		PlantID:      "shop-south",
		SourceSystem: "ironiq-edge",
		MachineID:    "MC-UMC750-01",
		CapturePath:  "mtconnect",
		EventType:    "heartbeat",
		TsUTC:        "2026-08-27T14:32:01Z",
		State:        "IDLE",
	}
	item, err := q.Enqueue([]mapper.Event{ev})
	if err != nil {
		t.Fatal(err)
	}
	if q.Len() != 1 {
		t.Fatal("expected queued")
	}

	// Simulate 5xx: keep
	if err := q.MarkRetry(item.ID); err != nil {
		t.Fatal(err)
	}
	pending := q.Pending()
	if len(pending) != 1 || pending[0].Attempts != 1 {
		t.Fatalf("retry should keep item: %+v", pending)
	}

	// Simulate 400: drop, never retry
	if err := q.Drop(item.ID); err != nil {
		t.Fatal(err)
	}
	if q.Len() != 0 {
		t.Fatal("400 must not stay in the buffer")
	}

	if ingest.Drop == ingest.Retry {
		t.Fatal("outcomes must differ")
	}
}

func TestReopenPersists(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "buf.json")
	q, err := buffer.Open(path)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := q.Enqueue([]mapper.Event{{
		Schema: "iss.machine_event.v1", PlantID: "p", SourceSystem: "ironiq-edge",
		MachineID: "M1", CapturePath: "mtconnect", EventType: "heartbeat",
		TsUTC: "2026-08-27T14:32:01Z", State: "IDLE",
	}}); err != nil {
		t.Fatal(err)
	}
	q2, err := buffer.Open(path)
	if err != nil {
		t.Fatal(err)
	}
	if q2.Len() != 1 {
		t.Fatalf("expected persisted item, len=%d", q2.Len())
	}
}
