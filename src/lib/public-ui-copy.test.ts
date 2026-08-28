import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

function source(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

describe("public UI copy", () => {
  it("does not leak internal filenames on public, sign-in, or home", () => {
    const leak = /MIGRATION_PHASE2\.md|schema_additions_[a-z0-9_]+\.sql/;
    expect(source("src/routes/index.tsx")).not.toMatch(leak);
    expect(source("src/routes/auth.tsx")).not.toMatch(leak);
    expect(source("src/routes/_authenticated/home.tsx")).not.toMatch(leak);
  });

  it("does not leak internal filenames on the sign-in page", () => {
    const auth = source("src/routes/auth.tsx");
    expect(auth).not.toMatch(/MIGRATION_PHASE2\.md/);
    expect(auth).not.toMatch(/schema_additions_[a-z0-9_]+\.sql/);
    expect(auth).toContain('title="Google sign-in coming soon"');
    expect(auth).toContain("an admin must approve");
  });

  it("does not lead the logged-in home launchpad with Assessments", () => {
    const home = source("src/routes/_authenticated/home.tsx");
    const productsStart = home.indexOf("const PRODUCTS = [");
    const firstLabel = home.slice(productsStart).match(/label:\s*"([^"]+)"/);
    expect(firstLabel?.[1]).not.toBe("Assessments");
    expect(firstLabel?.[1]).toBe("Machines");
    expect(home).toContain('to: "/machines"');
    expect(home).not.toContain('to: "/assessment"');
  });

  it("does not put the edge ingest secret or schema filenames on public/auth/home", () => {
    const auth = source("src/routes/auth.tsx");
    const home = source("src/routes/_authenticated/home.tsx");
    const index = source("src/routes/index.tsx");
    for (const page of [auth, home, index]) {
      expect(page).not.toMatch(/IRONIQ_EDGE_INGEST_SECRET/);
      expect(page).not.toMatch(/schema_additions_machine_events/);
      expect(page).not.toMatch(/edge\/README/);
      expect(page).not.toMatch(/go\.mod/);
    }
  });

  it("tells Floor that live LAN feeds use the Edge app, not cloud pull", () => {
    const floor = source("src/routes/_authenticated/floor.tsx");
    expect(floor).toMatch(/Live LAN feeds use the Edge app/);
    expect(floor).toMatch(/not cloud pull/);
    expect(floor).toContain("Generate a facility key below (shown once)");
  });

  it("does not leak internal filenames on home, auth, or Floor View", () => {
    for (const rel of [
      "src/routes/auth.tsx",
      "src/routes/_authenticated/home.tsx",
      "src/routes/_authenticated/floor.tsx",
    ]) {
      const text = source(rel);
      expect(text).not.toMatch(/MIGRATION_PHASE2\.md/);
      expect(text).not.toMatch(/schema_additions_[a-z0-9_]+\.sql/);
    }
  });

  it("gives IronIQ Edge (Floor View, Parts, Improvements) its own nav section, grouped with Intelligence rather than as a peer of Machines/Assessments/CAD/CNC", () => {
    const shell = source("src/components/ironiq/app-shell.tsx");
    expect(shell).toContain('to: "/machines"');
    expect(shell).toContain('section: "IronIQ Edge"');
    expect(shell).toContain('label: "Floor View"');
    expect(shell).toContain('to: "/floor"');
    expect(source("src/routes/_authenticated/machines/index.tsx")).toContain(
      "Machine master",
    );
    // IronIQ Edge and Ask IronIQ live in their own INTELLIGENCE_NAV
    // array, not PRODUCT_NAV -- confirm the section header appears
    // after PRODUCT_NAV's declaration closes, not inside it.
    const productNavEnd = shell.indexOf("const INTELLIGENCE_NAV");
    const productNavText = shell.slice(0, productNavEnd);
    expect(productNavText).not.toContain('section: "IronIQ Edge"');
    expect(shell.indexOf('section: "Intelligence"')).toBeGreaterThan(
      productNavEnd,
    );
  });
});
