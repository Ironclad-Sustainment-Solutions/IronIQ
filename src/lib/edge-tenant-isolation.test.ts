import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

function source(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

describe("IronIQ Edge tenant isolation", () => {
  it("does not authenticate ingest with a shared global secret", () => {
    const ingest = source("src/lib/machine-event-ingest.server.ts");
    const env = source(".env.example");
    expect(ingest).not.toMatch(/process\.env\.IRONIQ_EDGE_INGEST_SECRET/);
    expect(ingest).toContain("edge_ingest_key_hash");
    expect(ingest).toContain("organizationId");
    expect(env).not.toMatch(/IRONIQ_EDGE_INGEST_SECRET\s*=/);
  });

  it("looks up machines by asset_id + facility + organization, not asset_id alone", () => {
    const ingest = source("src/lib/machine-event-ingest.server.ts");
    expect(ingest).toMatch(
      /WHERE asset_id = \$1 AND facility_id = \$2 AND organization_id = \$3/,
    );
  });

  it("stamps ingest writes from the authenticated facility's organization", () => {
    const ingest = source("src/lib/machine-event-ingest.server.ts");
    expect(ingest).toContain("organization_id: tenant.organizationId");
    expect(ingest).toContain("facility_id: tenant.facilityId");
  });

  it("scopes floor, parts, improvements, and program-map queries by org and facility", () => {
    const floor = source("src/lib/machine-events.functions.ts");
    const floorServer = source("src/lib/machine-events.server.ts");
    const parts = source("src/lib/part-capture.server.ts");
    const improvements = source("src/lib/machine-improvements.functions.ts");
    const maps = source("src/lib/machine-program-parts.functions.ts");
    const intelligence = source("src/lib/intelligence-capture.server.ts");

    expect(floor).toMatch(/organization_id = \$1 AND facility_id = \$2/);
    expect(floorServer).toMatch(/organization_id = \$1/);
    expect(floorServer).toMatch(/facility_id = \$2/);
    expect(parts).toMatch(/e\.organization_id = \$2/);
    expect(parts).toMatch(/e\.facility_id = \$3/);
    expect(improvements).toMatch(
      /WHERE i\.organization_id = \$1 AND i\.facility_id = \$2/,
    );
    expect(improvements).toMatch(/AND organization_id = \$3/);
    expect(improvements).toMatch(/AND facility_id = \$4/);
    expect(maps).toMatch(/WHERE organization_id = \$1 AND plant_id = \$2/);
    expect(intelligence).toMatch(
      /AND organization_id = \$3 AND facility_id = \$4/,
    );
  });

  it("keeps idempotency per organization and facility so two shops can share an asset_id", () => {
    const events = source("db/schema_additions_machine_events.sql");
    const isolation = source(
      "db/schema_additions_machine_events_tenant_isolation.sql",
    );
    expect(events).toMatch(
      /UNIQUE NULLS NOT DISTINCT \(organization_id, facility_id, machine_id, ts_utc, event_type, cycle_seq\)/,
    );
    expect(isolation).toContain("shop_machine_events_align_tenant");
    expect(isolation).toMatch(
      /UNIQUE NULLS NOT DISTINCT \(\s*organization_id, facility_id, machine_id, ts_utc, event_type, cycle_seq\s*\)/,
    );
  });

  it("seeds the Haas UMC-750 demo machine only inside a demo org facility", () => {
    const seed = source("db/seed_demo_data.sql");
    expect(seed).toMatch(/o\.name LIKE '\[DEMO\]%'/);
    expect(seed).toMatch(
      /WHERE organization_id = v_org\s+AND facility_id = v_fac\s+AND asset_id = 'MC-UMC750-01'/,
    );
    expect(seed).not.toMatch(
      /WHERE NOT EXISTS \(\s*SELECT 1 FROM public\.shop_machines WHERE asset_id = 'MC-UMC750-01'\s*\)/,
    );
  });

  it("does not require plant_id grede-biscoe in product routes or ingest auth", () => {
    const ingest = source("src/lib/machine-event-ingest.server.ts");
    const floor = source("src/routes/_authenticated/floor.tsx");
    const parts = source("src/routes/_authenticated/machines/parts.tsx");
    const improvements = source(
      "src/routes/_authenticated/machines/improvements.tsx",
    );
    const programMap = source(
      "src/routes/_authenticated/machines/program-map.tsx",
    );
    for (const page of [ingest, floor, parts, improvements, programMap]) {
      expect(page).not.toMatch(/grede-biscoe/);
      expect(page).not.toMatch(/\bGrede\b/);
    }
  });
});
