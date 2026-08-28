import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

function source(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

describe("public UI copy", () => {
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

  it("does not leak internal filenames on home, auth, or Floor", () => {
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

  it("adds Floor under Machines without replacing the machine master", () => {
    const shell = source("src/components/ironiq/app-shell.tsx");
    expect(shell).toContain('to: "/machines"');
    expect(shell).toContain('label: "Floor"');
    expect(shell).toContain('to: "/floor"');
    expect(source("src/routes/_authenticated/machines/index.tsx")).toContain(
      "Machine master",
    );
  });
});
