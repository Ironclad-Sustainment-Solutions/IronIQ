import { describe, expect, it } from "vitest";
import { mapMachineRow } from "./edge-machine-config.server";

describe("mapMachineRow", () => {
  it("maps a ready MTConnect machine correctly", () => {
    expect(
      mapMachineRow({
        asset_id: "MC-01",
        control: "haas",
        protocol: "mtconnect",
        mtconnect_agent_url: "http://192.168.1.50:8082",
        focas_host: null,
        focas_port: null,
      }),
    ).toEqual({
      asset_id: "MC-01",
      protocol: "mtconnect",
      mtconnect_url: "http://192.168.1.50:8082",
      controller_make: "Haas",
    });
  });

  it("maps a ready FOCAS machine correctly", () => {
    expect(
      mapMachineRow({
        asset_id: "MC-FANUC",
        control: "fanuc",
        protocol: "fanuc_focas",
        mtconnect_agent_url: null,
        focas_host: "192.168.1.60",
        focas_port: 8193,
      }),
    ).toEqual({
      asset_id: "MC-FANUC",
      protocol: "focas",
      focas_host: "192.168.1.60",
      focas_port: 8193,
      controller_make: "Fanuc",
    });
  });

  it("excludes an mtconnect machine with no URL entered yet, rather than generating a broken entry", () => {
    expect(
      mapMachineRow({
        asset_id: "MC-NOT-READY",
        control: "haas",
        protocol: "mtconnect",
        mtconnect_agent_url: null,
        focas_host: null,
        focas_port: null,
      }),
    ).toBeNull();
  });

  it("excludes a fanuc_focas machine missing host or port", () => {
    expect(
      mapMachineRow({
        asset_id: "MC-NO-HOST",
        control: "fanuc",
        protocol: "fanuc_focas",
        mtconnect_agent_url: null,
        focas_host: null,
        focas_port: 8193,
      }),
    ).toBeNull();
    expect(
      mapMachineRow({
        asset_id: "MC-NO-PORT",
        control: "fanuc",
        protocol: "fanuc_focas",
        mtconnect_agent_url: null,
        focas_host: "192.168.1.60",
        focas_port: null,
      }),
    ).toBeNull();
  });

  it("excludes machines with a protocol the Edge agent doesn't support", () => {
    for (const protocol of ["none", "opc_ua", "manual"]) {
      expect(
        mapMachineRow({
          asset_id: "MC-X",
          control: "other",
          protocol,
          mtconnect_agent_url: null,
          focas_host: null,
          focas_port: null,
        }),
      ).toBeNull();
    }
  });

  it("defaults an unrecognized control value to Other rather than crashing", () => {
    const result = mapMachineRow({
      asset_id: "MC-01",
      control: "some_future_control_value",
      protocol: "mtconnect",
      mtconnect_agent_url: "http://192.168.1.50:8082",
      focas_host: null,
      focas_port: null,
    });
    expect(result?.controller_make).toBe("Other");
  });
});
