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
    }
  });
});
