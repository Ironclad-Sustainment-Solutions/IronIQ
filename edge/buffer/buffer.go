// Package buffer is a durable on-disk queue (SQLite-style: persist, retry
// 5xx, drop 400) for events that could not be posted to IronIQ.
package buffer

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sync"

	"ironiq-edge/mapper"
)

type Item struct {
	ID       int64          `json:"id"`
	Events   []mapper.Event `json:"events"`
	Attempts int            `json:"attempts"`
}

type fileShape struct {
	NextID int64  `json:"next_id"`
	Items  []Item `json:"items"`
}

// Queue is a process-local durable queue stored as one JSON file.
type Queue struct {
	path string
	mu   sync.Mutex
	data fileShape
}

func Open(path string) (*Queue, error) {
	q := &Queue{path: path, data: fileShape{NextID: 1}}
	raw, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil && filepath.Dir(path) != "." {
				return nil, err
			}
			return q, q.flushLocked()
		}
		return nil, err
	}
	if len(raw) > 0 {
		if err := json.Unmarshal(raw, &q.data); err != nil {
			return nil, err
		}
	}
	if q.data.NextID < 1 {
		q.data.NextID = 1
	}
	return q, nil
}

func (q *Queue) Enqueue(events []mapper.Event) (Item, error) {
	q.mu.Lock()
	defer q.mu.Unlock()
	item := Item{ID: q.data.NextID, Events: events}
	q.data.NextID++
	q.data.Items = append(q.data.Items, item)
	if err := q.flushLocked(); err != nil {
		return Item{}, err
	}
	return item, nil
}

func (q *Queue) Pending() []Item {
	q.mu.Lock()
	defer q.mu.Unlock()
	out := make([]Item, len(q.data.Items))
	copy(out, q.data.Items)
	return out
}

func (q *Queue) Drop(id int64) error {
	q.mu.Lock()
	defer q.mu.Unlock()
	items := q.data.Items[:0]
	for _, it := range q.data.Items {
		if it.ID != id {
			items = append(items, it)
		}
	}
	q.data.Items = items
	return q.flushLocked()
}

func (q *Queue) MarkRetry(id int64) error {
	q.mu.Lock()
	defer q.mu.Unlock()
	for i := range q.data.Items {
		if q.data.Items[i].ID == id {
			q.data.Items[i].Attempts++
			break
		}
	}
	return q.flushLocked()
}

func (q *Queue) Len() int {
	q.mu.Lock()
	defer q.mu.Unlock()
	return len(q.data.Items)
}

func (q *Queue) flushLocked() error {
	raw, err := json.MarshalIndent(q.data, "", "  ")
	if err != nil {
		return err
	}
	tmp := q.path + ".tmp"
	if err := os.WriteFile(tmp, raw, 0o600); err != nil {
		return err
	}
	return os.Rename(tmp, q.path)
}
