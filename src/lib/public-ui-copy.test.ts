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
    // Renamed from "Machines" to "Capability" when the sidebar was
    // restructured into the Capability/Engineering/Operations/
    // Intelligence taxonomy -- the label changed, but the protective
    // intent (don't lead with Assessments, do lead somewhere that
    // actually reaches /machines) still holds.
    expect(firstLabel?.[1]).toBe("Capability");
    expect(home).toContain('to: "/machines"');
    expect(home).not.toContain('to: "/assessment"');
  });

  it("links the Edge setup panel's setup instructions in-app, not to GitHub", () => {
    // Direct feedback: customers shouldn't need to visit a developer-
    // facing GitHub repo to read setup instructions -- the guide lives
    // inside the app itself.
    const panel = source("src/components/ironiq/edge-setup-panel.tsx");
    expect(panel).not.toContain("github.com");
    expect(panel).toContain("/machines/edge-setup-guide");
    const guide = source(
      "src/routes/_authenticated/machines/edge-setup-guide.tsx",
    );
    expect(guide).toContain("IronIQ Edge setup guide");
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

  it("tells the shared Edge setup panel that live LAN feeds use the Edge app, not cloud pull -- and confirms every page that should show it actually does", () => {
    // Moved into a shared component specifically so Floor, Machines,
    // and the machine detail page can't quietly drift out of sync with
    // each other the way the Home page's product cards did with the
    // sidebar -- this test protects that by checking the one canonical
    // source, then confirming every intended call site actually uses it.
    const panel = source("src/components/ironiq/edge-setup-panel.tsx");
    expect(panel).toMatch(/Live LAN feeds use the Edge app/);
    expect(panel).toMatch(/not cloud pull/);
    expect(panel).toContain("Generate a facility key below (shown once)");

    for (const rel of [
      "src/routes/_authenticated/floor.tsx",
      "src/routes/_authenticated/machines/index.tsx",
      "src/routes/_authenticated/machines/$machineId.tsx",
    ]) {
      const text = source(rel);
      expect(text).toContain("EdgeSetupPanel");
      // The old, page-specific copies of this panel should never come
      // back -- if this text starts appearing directly in one of these
      // route files again instead of just an EdgeSetupPanel usage, the
      // shared component was bypassed.
      expect(text).not.toContain("Generate a facility key below (shown once)");
    }
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

  it("distributes former IronIQ Edge features (Floor View, Parts, Improvements) into the Capability/Operations taxonomy rather than keeping them as their own section", () => {
    const shell = source("src/components/ironiq/app-shell.tsx");
    expect(shell).toContain('to: "/machines"');
    expect(shell).not.toContain('section: "IronIQ Edge"');
    expect(shell).toContain('label: "Floor View"');
    expect(shell).toContain('to: "/floor"');
    expect(source("src/routes/_authenticated/machines/index.tsx")).toContain(
      "Machine master",
    );
    // Parts lives under Capability, Floor View/Improvements under
    // Operations -- confirm both taxonomy sections exist and neither
    // resurrects a standalone "IronIQ Edge" heading.
    expect(shell).toContain('section: "Capability"');
    expect(shell).toContain('section: "Operations"');
    expect(shell).toContain('section: "Intelligence"');
  });

  it("does not put Grede-only product copy on Edge or field surfaces", () => {
    const floor = source("src/routes/_authenticated/floor.tsx");
    const parts = source("src/routes/_authenticated/machines/parts.tsx");
    const improvements = source(
      "src/routes/_authenticated/machines/improvements.tsx",
    );
    const programMap = source(
      "src/routes/_authenticated/machines/program-map.tsx",
    );
    const field = source("src/routes/_authenticated/field/$fieldId.tsx");
    for (const page of [floor, parts, improvements, programMap]) {
      expect(page).not.toMatch(/\bGrede\b/);
    }
    expect(field).not.toMatch(/Grede focus areas/);
    expect(field).toContain('title="Focus areas"');
  });
});
