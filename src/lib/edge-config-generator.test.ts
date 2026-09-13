import { describe, expect, it } from "vitest";
import {
  buildEdgeConfigJson,
  buildEdgeConfigMachines,
} from "./edge-config-generator";

describe("buildEdgeConfigMachines", () => {
  it("uses the machine's real, already-on-file MTConnect URL when it has one", () => {
    const [entry] = buildEdgeConfigMachines([
      {
        asset_id: "MC-UMC750-01",
        control: "haas",
        protocol: "mtconnect",
        mtconnect_agent_url: "http://192.168.1.50:8082",
      },
    ]);
    expect(entry).toEqual({
      asset_id: "MC-UMC750-01",
      protocol: "mtconnect",
      mtconnect_url: "http://192.168.1.50:8082",
      controller_make: "Haas",
    });
  });

  it("falls back to a placeholder URL when no real one is on file yet", () => {
    const [entry] = buildEdgeConfigMachines([
      {
        asset_id: "MC-01",
        control: "mazak",
        protocol: "mtconnect",
        mtconnect_agent_url: null,
      },
    ]);
    expect(entry.protocol).toBe("mtconnect");
    expect((entry as { mtconnect_url: string }).mtconnect_url).toContain(
      "<machine-lan-ip>",
    );
    expect(entry.controller_make).toBe("Mazak");
  });

  it("maps fanuc_focas machines to the focas protocol shape, not mtconnect", () => {
    const [entry] = buildEdgeConfigMachines([
      {
        asset_id: "MC-FANUC-01",
        control: "fanuc",
        protocol: "fanuc_focas",
        mtconnect_agent_url: null,
      },
    ]);
    expect(entry).toEqual({
      asset_id: "MC-FANUC-01",
      protocol: "focas",
      focas_host: "<machine-lan-ip>",
      focas_port: 8193,
      controller_make: "Fanuc",
    });
  });

  it("skips machines whose protocol the Edge agent doesn't support, rather than generating a wrong entry", () => {
    const entries = buildEdgeConfigMachines([
      {
        asset_id: "MC-NONE",
        control: "other",
        protocol: "none",
        mtconnect_agent_url: null,
      },
      {
        asset_id: "MC-OPCUA",
        control: "siemens",
        protocol: "opc_ua",
        mtconnect_agent_url: null,
      },
      {
        asset_id: "MC-MANUAL",
        control: "other",
        protocol: "manual",
        mtconnect_agent_url: null,
      },
    ]);
    expect(entries).toEqual([]);
  });

  it("handles a mix of supported and unsupported machines correctly", () => {
    const entries = buildEdgeConfigMachines([
      {
        asset_id: "MC-01",
        control: "haas",
        protocol: "mtconnect",
        mtconnect_agent_url: "http://10.0.0.5:8082",
      },
      {
        asset_id: "MC-02",
        control: "other",
        protocol: "none",
        mtconnect_agent_url: null,
      },
      {
        asset_id: "MC-03",
        control: "fanuc",
        protocol: "fanuc_focas",
        mtconnect_agent_url: null,
      },
    ]);
    expect(entries).toHaveLength(2);
    expect(entries.map((e) => e.asset_id)).toEqual(["MC-01", "MC-03"]);
  });
});

describe("buildEdgeConfigJson", () => {
  it("produces valid, parseable JSON with the real facility key and URL", () => {
    const json = buildEdgeConfigJson({
      baseUrl: "https://ironiq.onrender.com",
      facilityKey: "fk_live_abc123",
      plantId: "shop-south",
      machines: [
        {
          asset_id: "MC-01",
          control: "haas",
          protocol: "mtconnect",
          mtconnect_agent_url: "http://10.0.0.5:8082",
        },
      ],
    });
    const parsed = JSON.parse(json);
    expect(parsed.ironiq_url).toBe("https://ironiq.onrender.com");
    expect(parsed.facility_key).toBe("fk_live_abc123");
    expect(parsed.plant_id).toBe("shop-south");
    expect(parsed.machines).toHaveLength(1);
    expect(parsed.machines[0].mtconnect_url).toBe("http://10.0.0.5:8082");
  });

  it("never produces an empty machines array, even with zero real machines", () => {
    const json = buildEdgeConfigJson({
      baseUrl: "https://ironiq.onrender.com",
      facilityKey: "fk_live_abc123",
      plantId: "shop-south",
      machines: [],
    });
    const parsed = JSON.parse(json);
    expect(parsed.machines.length).toBeGreaterThan(0);
    expect(parsed.machines[0].asset_id).toContain("<");
  });

  it("is pretty-printed, not minified, since a person may need to read/edit it", () => {
    const json = buildEdgeConfigJson({
      baseUrl: "https://ironiq.onrender.com",
      facilityKey: "fk_live_abc123",
      plantId: "shop-south",
      machines: [],
    });
    expect(json).toContain("\n");
    expect(json).toMatch(/^\{\n {2}"ironiq_url"/);
  });
});
