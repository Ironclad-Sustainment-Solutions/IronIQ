import { describe, expect, it } from "vitest";
import {
  looksLikeNaturalLanguageQuestion,
  matchPages,
} from "./universal-search.functions";

describe("matchPages", () => {
  it("finds a page by its new, renamed label", () => {
    // The whole point of this feature: after the Shop/Engineering/
    // Production/Reports rename, these labels need to actually be
    // searchable, not just visually correct in the sidebar.
    const results = matchPages("Findings");
    expect(results.some((r) => r.href === "/findings")).toBe(true);
  });

  it("finds Ask IronIQ by its real current name, not the old 'Insights' label", () => {
    const results = matchPages("Ask IronIQ");
    expect(results.some((r) => r.href === "/ask-ironiq")).toBe(true);
    const oldName = matchPages("Insights");
    expect(oldName.some((r) => r.href === "/ask-ironiq")).toBe(false);
  });

  it("matches by section name too, not just page label", () => {
    // Searching "Reports" should surface every page under that section,
    // not just a page literally named "Reports" (there isn't one).
    const results = matchPages("Reports");
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((r) => r.sublabel === "Reports")).toBe(true);
  });

  it("is case-insensitive", () => {
    const lower = matchPages("suppliers");
    const upper = matchPages("SUPPLIERS");
    expect(lower.map((r) => r.href)).toEqual(upper.map((r) => r.href));
    expect(lower.some((r) => r.href === "/suppliers")).toBe(true);
  });

  it("returns no results for an empty or whitespace-only query", () => {
    expect(matchPages("")).toEqual([]);
    expect(matchPages("   ")).toEqual([]);
  });

  it("does not resurrect a page under its old, pre-rename name", () => {
    // Direct regression check for the actual rename: "Capability",
    // "Operations", "Intelligence", "Processes", "Risks", "Actions", and
    // "Technical Data" were all real labels before this rename and
    // should not match anything anymore.
    for (const oldName of [
      "Capability",
      "Operations",
      "Intelligence",
      "Processes",
      "Risks",
      "Actions",
      "Technical Data",
      "Capability Health",
    ]) {
      expect(matchPages(oldName)).toEqual([]);
    }
  });

  it("caps results per query", () => {
    // "e" alone would otherwise match a large fraction of labels/sections.
    const results = matchPages("e");
    expect(results.length).toBeLessThanOrEqual(5);
  });
});

describe("looksLikeNaturalLanguageQuestion (regression: unaffected by the nav rename)", () => {
  it("still behaves the same as before -- this file's other export shouldn't have moved", () => {
    expect(looksLikeNaturalLanguageQuestion("what is going on?")).toBe(true);
    expect(looksLikeNaturalLanguageQuestion("MC-01")).toBe(false);
  });
});
