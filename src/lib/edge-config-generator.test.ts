import { describe, expect, it } from "vitest";
import { buildEdgeConfigJson } from "./edge-config-generator";

describe("buildEdgeConfigJson", () => {
  it("produces valid, parseable JSON with the real facility key and URL", () => {
    const json = buildEdgeConfigJson({
      baseUrl: "https://ironiq.onrender.com",
      facilityKey: "fk_live_abc123",
      plantId: "shop-south",
    });
    const parsed = JSON.parse(json);
    expect(parsed.ironiq_url).toBe("https://ironiq.onrender.com");
    expect(parsed.facility_key).toBe("fk_live_abc123");
    expect(parsed.plant_id).toBe("shop-south");
  });

  it("does not include a machines array -- the agent fetches that dynamically now", () => {
    const json = buildEdgeConfigJson({
      baseUrl: "https://ironiq.onrender.com",
      facilityKey: "fk_live_abc123",
      plantId: "shop-south",
    });
    const parsed = JSON.parse(json);
    expect(parsed.machines).toBeUndefined();
  });

  it("is pretty-printed, not minified, since a person may need to read/edit it", () => {
    const json = buildEdgeConfigJson({
      baseUrl: "https://ironiq.onrender.com",
      facilityKey: "fk_live_abc123",
      plantId: "shop-south",
    });
    expect(json).toContain("\n");
    expect(json).toMatch(/^\{\n {2}"ironiq_url"/);
  });
});
