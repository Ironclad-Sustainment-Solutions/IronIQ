// Package mtconnect is a real MTConnect (https://www.mtconnect.org/) client
// -- the only one of shop_machines' three live protocol options
// (mtconnect, opc_ua, fanuc_focas) that's a plain HTTP+XML REST API with
// a public, stable spec. This is a direct port of
// src/lib/mtconnect-client.server.ts (the TypeScript client already
// built and tested against a real mock agent for the cloud-pull design)
// to Go, for the bridge agent -- same parsing rules, same state-mapping
// semantics, uses only Go's standard library (net/http, encoding/xml),
// so the compiled binary has zero runtime dependencies.
package mtconnect

import (
	"context"
	"encoding/xml"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"
)

// CurrentReading mirrors MTConnectCurrentReading in mtconnect-client.server.ts.
type CurrentReading struct {
	DeviceName    string
	Sequence      *int64
	Timestamp     string
	State         string // "active" | "idle" | "down"
	RawExecution  string
	PartCount     *float64
	PartNumber    string
}

var executionActive = map[string]bool{"ACTIVE": true}

var executionIdle = map[string]bool{
	"READY":              true,
	"STOPPED":            true,
	"PROGRAM_STOPPED":    true,
	"PROGRAM_COMPLETED":  true,
	"OPTIONAL_STOP":      true,
	"INTERRUPTED":        true,
	"FEED_HOLD":          true,
}

// --- minimal XML shape, enough to find Header/DeviceStream/DataItem values
// without needing a full MTConnectStreams schema binding ---

type mtcElement struct {
	XMLName  xml.Name
	Attrs    []xml.Attr   `xml:",any,attr"`
	Content  string       `xml:",chardata"`
	Children []mtcElement `xml:",any"`
}

func (e *mtcElement) attr(name string) (string, bool) {
	for _, a := range e.Attrs {
		if a.Name.Local == name {
			return a.Value, true
		}
	}
	return "", false
}

// findAll returns every descendant (and self) element with the given
// local tag name, anywhere in the tree -- matches the TypeScript client's
// getElementsByTagName-based search, deliberately not tied to a specific
// nesting depth since real agents vary in how they nest ComponentStreams.
func (e *mtcElement) findAll(tag string) []*mtcElement {
	var out []*mtcElement
	if e.XMLName.Local == tag {
		out = append(out, e)
	}
	for i := range e.Children {
		out = append(out, e.Children[i].findAll(tag)...)
	}
	return out
}

func (e *mtcElement) firstByTag(tag string) *mtcElement {
	found := e.findAll(tag)
	if len(found) == 0 {
		return nil
	}
	return found[0]
}

func fetchXML(ctx context.Context, url string) (*mtcElement, error) {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("could not reach MTConnect agent at %s: %w", url, err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("MTConnect agent at %s returned HTTP %d", url, resp.StatusCode)
	}
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	var root mtcElement
	if err := xml.Unmarshal(body, &root); err != nil {
		return nil, fmt.Errorf("MTConnect agent response wasn't valid XML: %w", err)
	}
	return &root, nil
}

func stripTrailingSlash(url string) string {
	return strings.TrimSuffix(url, "/")
}

// ProbeDevice describes one device found in a /probe response.
type ProbeDevice struct {
	Name string
	UUID string
}

// Probe calls GET {agentUrl}/probe to discover devices, for setup validation.
func Probe(ctx context.Context, agentURL string) ([]ProbeDevice, error) {
	root, err := fetchXML(ctx, stripTrailingSlash(agentURL)+"/probe")
	if err != nil {
		return nil, err
	}
	deviceEls := root.findAll("Device")
	if len(deviceEls) == 0 {
		return nil, fmt.Errorf("MTConnect agent's /probe response had no Device entries")
	}
	devices := make([]ProbeDevice, 0, len(deviceEls))
	for _, el := range deviceEls {
		name, _ := el.attr("name")
		uuid, _ := el.attr("uuid")
		devices = append(devices, ProbeDevice{Name: name, UUID: uuid})
	}
	return devices, nil
}

func findDeviceStream(root *mtcElement, deviceName string) (*mtcElement, error) {
	streams := root.findAll("DeviceStream")
	if len(streams) == 0 {
		return nil, fmt.Errorf("MTConnect agent response had no DeviceStream -- is the device name correct?")
	}
	if deviceName != "" {
		var names []string
		for _, s := range streams {
			name, _ := s.attr("name")
			names = append(names, name)
			if name == deviceName {
				return s, nil
			}
		}
		return nil, fmt.Errorf(
			"MTConnect agent doesn't have a device named %q. Devices available: %s",
			deviceName, strings.Join(names, ", "),
		)
	}
	return streams[0], nil
}

// Current calls GET {agentUrl}/current -- the latest value of every
// DataItem for the matched device. deviceName may be empty to match
// whichever DeviceStream comes first.
func Current(ctx context.Context, agentURL, deviceName string) (*CurrentReading, error) {
	root, err := fetchXML(ctx, stripTrailingSlash(agentURL)+"/current")
	if err != nil {
		return nil, err
	}

	header := root.firstByTag("Header")
	var sequence *int64
	if header != nil {
		seqStr, ok := header.attr("lastSequence")
		if !ok {
			seqStr, ok = header.attr("nextSequence")
		}
		if ok {
			if v, err := strconv.ParseInt(seqStr, 10, 64); err == nil {
				sequence = &v
			}
		}
	}

	deviceStream, err := findDeviceStream(root, deviceName)
	if err != nil {
		return nil, err
	}
	resolvedName, _ := deviceStream.attr("name")
	if resolvedName == "" {
		resolvedName = deviceName
	}
	if resolvedName == "" {
		resolvedName = "unknown"
	}

	executionEl := deviceStream.firstByTag("Execution")
	availabilityEl := deviceStream.firstByTag("Availability")
	partCountEl := deviceStream.firstByTag("PartCount")
	if partCountEl == nil {
		partCountEl = deviceStream.firstByTag("PartCountAct")
	}
	partNumberEl := deviceStream.firstByTag("PartNumber")
	if partNumberEl == nil {
		partNumberEl = deviceStream.firstByTag("PartNumberAct")
	}

	rawExecution := ""
	if executionEl != nil {
		rawExecution = strings.TrimSpace(executionEl.Content)
	}
	rawAvailability := ""
	if availabilityEl != nil {
		rawAvailability = strings.TrimSpace(availabilityEl.Content)
	}

	var state string
	switch {
	case rawExecution != "" && executionActive[rawExecution]:
		state = "active"
	case rawExecution != "" && executionIdle[rawExecution]:
		state = "idle"
	case rawExecution == "UNAVAILABLE" || rawAvailability == "UNAVAILABLE":
		state = "down"
	case rawExecution == "":
		// Neither Execution nor a recognized Availability value at all --
		// treat as down rather than silently assuming idle.
		state = "down"
	default:
		// An Execution value that exists but isn't in either known set
		// (agent-specific extension value) -- treat as idle rather than
		// guessing it's actively cutting.
		state = "idle"
	}

	var partCount *float64
	if partCountEl != nil {
		raw := strings.TrimSpace(partCountEl.Content)
		if v, err := strconv.ParseFloat(raw, 64); err == nil {
			partCount = &v
		}
	}

	partNumber := ""
	if partNumberEl != nil {
		partNumber = strings.TrimSpace(partNumberEl.Content)
	}

	timestamp := ""
	if executionEl != nil {
		timestamp, _ = executionEl.attr("timestamp")
	}
	if timestamp == "" && partCountEl != nil {
		timestamp, _ = partCountEl.attr("timestamp")
	}
	if timestamp == "" && header != nil {
		timestamp, _ = header.attr("creationTime")
	}
	if timestamp == "" {
		timestamp = time.Now().UTC().Format(time.RFC3339)
	}

	return &CurrentReading{
		DeviceName:   resolvedName,
		Sequence:     sequence,
		Timestamp:    timestamp,
		State:        state,
		RawExecution: rawExecution,
		PartCount:    partCount,
		PartNumber:   partNumber,
	}, nil
}
