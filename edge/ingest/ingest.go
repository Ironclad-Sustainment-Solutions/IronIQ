// Package ingest POSTs iss.machine_event.v1 envelopes to IronIQ Edge ingest.
// Auth is Authorization: Bearer <facility ingest key> only — never a query
// param, never a global shared secret, never /api/machines/{id}/ingest.
package ingest

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"ironiq-edge/mapper"
)

const Path = "/api/ironiq/v1/machine-events"

type Outcome int

const (
	OK    Outcome = iota
	Retry         // 5xx, timeout, network
	Drop          // 4xx including 400; never retry
)

func (o Outcome) String() string {
	switch o {
	case OK:
		return "ok"
	case Retry:
		return "retry"
	case Drop:
		return "drop"
	default:
		return "unknown"
	}
}

type Result struct {
	Outcome    Outcome
	StatusCode int
	Body       string
	Err        error
}

type Client struct {
	BaseURL     string
	FacilityKey string
	HTTP        *http.Client
	Timeout     time.Duration
}

func New(baseURL, facilityKey string, httpClient *http.Client) *Client {
	if httpClient == nil {
		httpClient = &http.Client{Timeout: 15 * time.Second}
	}
	return &Client{
		BaseURL:     strings.TrimRight(baseURL, "/"),
		FacilityKey: facilityKey,
		HTTP:        httpClient,
		Timeout:     15 * time.Second,
	}
}

type envelope struct {
	Events []mapper.Event `json:"events"`
}

// Post sends {events} with the facility bearer. A missing key is Drop, not
// an unauthenticated POST that might look valid.
func (c *Client) Post(ctx context.Context, events []mapper.Event) Result {
	if c.FacilityKey == "" {
		return Result{Outcome: Drop, Err: fmt.Errorf("facility ingest key is required")}
	}
	if len(events) == 0 {
		return Result{Outcome: OK}
	}
	payload, err := json.Marshal(envelope{Events: events})
	if err != nil {
		return Result{Outcome: Drop, Err: err}
	}

	url := c.BaseURL + Path
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(payload))
	if err != nil {
		return Result{Outcome: Drop, Err: err}
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.FacilityKey)

	resp, err := c.HTTP.Do(req)
	if err != nil {
		return Result{Outcome: Retry, Err: err}
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
	res := Result{StatusCode: resp.StatusCode, Body: string(body)}
	switch {
	case resp.StatusCode >= 200 && resp.StatusCode < 300:
		res.Outcome = OK
	case resp.StatusCode >= 500 || resp.StatusCode == http.StatusTooManyRequests:
		res.Outcome = Retry
		res.Err = fmt.Errorf("ingest HTTP %d: %s", resp.StatusCode, truncate(res.Body, 300))
	default:
		// 400 and other 4xx: never retry. 401 with a wrong key is not treated
		// as valid and is not retried as if it might succeed.
		res.Outcome = Drop
		res.Err = fmt.Errorf("ingest HTTP %d: %s", resp.StatusCode, truncate(res.Body, 300))
	}
	return res
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n]
}
