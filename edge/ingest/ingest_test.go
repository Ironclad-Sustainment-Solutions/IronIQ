package ingest_test

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"ironiq-edge/ingest"
	"ironiq-edge/mapper"
)

func sample() mapper.Event {
	seq := int64(41)
	prog := "O5123"
	mode := "AUTO"
	active := false
	return mapper.Event{
		Schema:         "iss.machine_event.v1",
		PlantID:        "shop-south",
		SourceSystem:   "ironiq-edge",
		MachineID:      "MC-UMC750-01",
		CapturePath:    "mtconnect",
		EventType:      "state_change",
		TsUTC:          "2026-08-27T14:32:01Z",
		State:          "RUNNING",
		ProgramName:    &prog,
		CycleSeq:       &seq,
		ControlMode:    &mode,
		AlarmActive:    &active,
		Quality:        &mapper.Quality{SourceOK: true},
		ControllerMake: strPtr("Haas"),
	}
}

func strPtr(s string) *string { return &s }

func TestPostUsesFacilityBearerNotQueryAndNotOldIngestPath(t *testing.T) {
	var gotAuth, gotPath, gotQuery, gotBody string
	var gotMethod string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotMethod = r.Method
		gotPath = r.URL.Path
		gotQuery = r.URL.RawQuery
		gotAuth = r.Header.Get("Authorization")
		raw, _ := io.ReadAll(r.Body)
		gotBody = string(raw)
		w.WriteHeader(http.StatusAccepted)
		_, _ = w.Write([]byte(`{"accepted":1,"duplicates":0}`))
	}))
	defer srv.Close()

	key := "facility-key-abc"
	client := ingest.New(srv.URL, key, srv.Client())
	res := client.Post(context.Background(), []mapper.Event{sample()})
	if res.Outcome != ingest.OK {
		t.Fatalf("outcome=%s err=%v", res.Outcome, res.Err)
	}
	if gotMethod != http.MethodPost {
		t.Fatalf("method %s", gotMethod)
	}
	if gotPath != "/api/ironiq/v1/machine-events" {
		t.Fatalf("path %s", gotPath)
	}
	if strings.Contains(gotPath, "/api/machines/") {
		t.Fatal("must not use closed #77 ingest path")
	}
	if gotQuery != "" {
		t.Fatalf("credential must not be in query: %s", gotQuery)
	}
	if gotAuth != "Bearer "+key {
		t.Fatalf("auth %q", gotAuth)
	}
	if strings.Contains(gotAuth, "wrong-key") {
		t.Fatal("wrong key sent")
	}
	var env struct {
		Events []mapper.Event `json:"events"`
	}
	if err := json.Unmarshal([]byte(gotBody), &env); err != nil {
		t.Fatal(err)
	}
	if len(env.Events) != 1 || env.Events[0].MachineID != "MC-UMC750-01" {
		t.Fatalf("body %s", gotBody)
	}
}

func TestWrongKeyIsNotSentAsIfValid(t *testing.T) {
	var auths []string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		auths = append(auths, r.Header.Get("Authorization"))
		w.WriteHeader(http.StatusUnauthorized)
		_, _ = w.Write([]byte(`{"error":"Unauthorized"}`))
	}))
	defer srv.Close()

	configured := "this-is-the-configured-key"
	wrong := "wrong-key"
	client := ingest.New(srv.URL, configured, srv.Client())
	res := client.Post(context.Background(), []mapper.Event{sample()})
	if res.Outcome != ingest.Drop {
		t.Fatalf("401 must drop, not retry or succeed: %s", res.Outcome)
	}
	if res.StatusCode != 401 {
		t.Fatalf("status %d", res.StatusCode)
	}
	if len(auths) != 1 || auths[0] != "Bearer "+configured {
		t.Fatalf("auths=%v", auths)
	}
	if strings.Contains(strings.Join(auths, ","), wrong) {
		t.Fatal("wrong key was sent as if valid")
	}
}

func TestEmptyKeyDoesNotPost(t *testing.T) {
	called := false
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
		w.WriteHeader(http.StatusAccepted)
	}))
	defer srv.Close()
	res := ingest.New(srv.URL, "", srv.Client()).Post(context.Background(), []mapper.Event{sample()})
	if called {
		t.Fatal("posted without a facility key")
	}
	if res.Outcome != ingest.Drop {
		t.Fatalf("outcome %s", res.Outcome)
	}
}

func TestTimeoutIsRetry(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(200 * time.Millisecond)
		w.WriteHeader(http.StatusAccepted)
	}))
	defer srv.Close()
	httpClient := srv.Client()
	httpClient.Timeout = 20 * time.Millisecond
	res := ingest.New(srv.URL, "k", httpClient).Post(context.Background(), []mapper.Event{sample()})
	if res.Outcome != ingest.Retry {
		t.Fatalf("timeout should retry, got %s err=%v", res.Outcome, res.Err)
	}
}

func TestStatusMapping(t *testing.T) {
	var status int
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(status)
	}))
	defer srv.Close()
	c := ingest.New(srv.URL, "k", srv.Client())

	status = 500
	if res := c.Post(context.Background(), []mapper.Event{sample()}); res.Outcome != ingest.Retry {
		t.Fatalf("500 -> %s", res.Outcome)
	}
	status = 503
	if res := c.Post(context.Background(), []mapper.Event{sample()}); res.Outcome != ingest.Retry {
		t.Fatalf("503 -> %s", res.Outcome)
	}
	status = 400
	if res := c.Post(context.Background(), []mapper.Event{sample()}); res.Outcome != ingest.Drop {
		t.Fatalf("400 -> %s", res.Outcome)
	}
	status = 202
	if res := c.Post(context.Background(), []mapper.Event{sample()}); res.Outcome != ingest.OK {
		t.Fatalf("202 -> %s", res.Outcome)
	}
}
