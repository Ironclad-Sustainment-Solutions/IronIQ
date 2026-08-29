// Package mtconnect is a read-only MTConnect client for the IronIQ Edge
// agent. It only ever GET /current (and /probe when needed). It never
// writes a CNC: no DNC, no Haas ?E, no FOCAS, no PMC.
//
// Parsing is a port of the #77 Go bridge / src/lib/mtconnect-client.server.ts
// rules, extended for Haas NGC fields used by iss.machine_event.v1:
// Execution, Availability, EmergencyStop, Program, PartCount,
// ControllerMode, and Condition Faults.
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

	"ironiq-edge/reading"
)

// Reading is kept as a type alias, not a new struct, so every existing
// caller (mapper.go, agent.go, all mtconnect tests) that referred to
// mtconnect.Reading before this refactor keeps compiling unchanged --
// the actual struct definition now lives in the reading package so a
// second collector (focas) can produce the same shape without importing
// mtconnect itself.
type Reading = reading.Reading

var executionRunning = map[string]bool{"ACTIVE": true}

var executionIdle = map[string]bool{
	"READY":             true,
	"STOPPED":           true,
	"PROGRAM_STOPPED":   true,
	"PROGRAM_COMPLETED": true,
	"OPTIONAL_STOP":     true,
	"INTERRUPTED":       true,
	"FEED_HOLD":         true,
}

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

func stripTrailingSlash(url string) string {
	return strings.TrimSuffix(url, "/")
}

func parseXML(body []byte) (*mtcElement, error) {
	var root mtcElement
	if err := xml.Unmarshal(body, &root); err != nil {
		return nil, fmt.Errorf("MTConnect agent response wasn't valid XML: %w", err)
	}
	return &root, nil
}

// ParseCurrent maps a Haas (or generic) MTConnectStreams /current document.
func ParseCurrent(body []byte, deviceName string) (*Reading, error) {
	root, err := parseXML(body)
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
	estopEl := deviceStream.firstByTag("EmergencyStop")
	programEl := deviceStream.firstByTag("Program")
	partCountEl := deviceStream.firstByTag("PartCount")
	if partCountEl == nil {
		partCountEl = deviceStream.firstByTag("PartCountAct")
	}
	modeEl := deviceStream.firstByTag("ControllerMode")

	rawExecution := textOf(executionEl)
	rawAvailability := textOf(availabilityEl)
	estop := textOf(estopEl)

	state := mapState(rawExecution, rawAvailability, estop)
	controlMode := mapControlMode(textOf(modeEl))
	alarmCode, alarmActive := firstFault(deviceStream)
	if strings.EqualFold(estop, "TRIGGERED") {
		alarmActive = true
		if alarmCode == "" {
			alarmCode = "ESTOP"
		}
		state = "DOWN"
	}

	var partCount *int64
	if partCountEl != nil {
		raw := strings.TrimSpace(partCountEl.Content)
		if v, err := strconv.ParseFloat(raw, 64); err == nil {
			n := int64(v)
			partCount = &n
		}
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

	return &Reading{
		DeviceName:    resolvedName,
		Sequence:      sequence,
		Timestamp:     timestamp,
		State:         state,
		RawExecution:  rawExecution,
		ProgramName:   textOf(programEl),
		PartCount:     partCount,
		ControlMode:   controlMode,
		AlarmCode:     alarmCode,
		AlarmActive:   alarmActive,
		EmergencyStop: estop,
		CuttingTimeS:  accumulatedSeconds(deviceStream, "Cutting"),
		SpindleOnS:    accumulatedSeconds(deviceStream, "Spindle"),
	}, nil
}

func textOf(el *mtcElement) string {
	if el == nil {
		return ""
	}
	return strings.TrimSpace(el.Content)
}

func mapState(execution, availability, estop string) string {
	if strings.EqualFold(estop, "TRIGGERED") {
		return "DOWN"
	}
	switch {
	case execution != "" && executionRunning[execution]:
		return "RUNNING"
	case execution != "" && executionIdle[execution]:
		return "IDLE"
	case execution == "UNAVAILABLE" || availability == "UNAVAILABLE":
		return "DOWN"
	case execution == "":
		return "DOWN"
	default:
		return "IDLE"
	}
}

func mapControlMode(raw string) *string {
	switch strings.ToUpper(strings.TrimSpace(raw)) {
	case "AUTOMATIC", "AUTO":
		v := "AUTO"
		return &v
	case "MANUAL_DATA_INPUT", "MDI", "MDA":
		v := "MDI"
		return &v
	case "MANUAL", "JOG", "MANUAL_JOG":
		v := "JOG"
		return &v
	default:
		return nil
	}
}

func firstFault(deviceStream *mtcElement) (code string, active bool) {
	for _, el := range deviceStream.findAll("Fault") {
		native, _ := el.attr("nativeCode")
		if native == "" {
			native, _ = el.attr("type")
		}
		text := strings.TrimSpace(el.Content)
		if native == "" {
			native = text
		}
		if native == "" {
			native = "FAULT"
		}
		return native, true
	}
	return "", false
}

func accumulatedSeconds(deviceStream *mtcElement, want string) *float64 {
	want = strings.ToLower(want)
	for _, el := range deviceStream.findAll("AccumulatedTime") {
		typ, _ := el.attr("type")
		name, _ := el.attr("name")
		sub, _ := el.attr("subType")
		blob := strings.ToLower(typ + " " + name + " " + sub)
		if !strings.Contains(blob, want) {
			continue
		}
		raw := strings.TrimSpace(el.Content)
		if v, err := strconv.ParseFloat(raw, 64); err == nil {
			return &v
		}
	}
	return nil
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

// ProbeDevice is one device from GET /probe.
type ProbeDevice struct {
	Name string
	UUID string
}

// ParseProbe maps an MTConnectDevices /probe document.
func ParseProbe(body []byte) ([]ProbeDevice, error) {
	root, err := parseXML(body)
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

func getXML(ctx context.Context, client *http.Client, url string) ([]byte, error) {
	if client == nil {
		client = http.DefaultClient
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("could not reach MTConnect agent at %s: %w", url, err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("MTConnect agent at %s returned HTTP %d", url, resp.StatusCode)
	}
	return io.ReadAll(resp.Body)
}

// Current GETs {agentURL}/current. Read-only: GET only.
func Current(ctx context.Context, client *http.Client, agentURL, deviceName string) (*Reading, error) {
	body, err := getXML(ctx, client, stripTrailingSlash(agentURL)+"/current")
	if err != nil {
		return nil, err
	}
	return ParseCurrent(body, deviceName)
}

// Probe GETs {agentURL}/probe. Read-only: GET only.
func Probe(ctx context.Context, client *http.Client, agentURL string) ([]ProbeDevice, error) {
	body, err := getXML(ctx, client, stripTrailingSlash(agentURL)+"/probe")
	if err != nil {
		return nil, err
	}
	return ParseProbe(body)
}
