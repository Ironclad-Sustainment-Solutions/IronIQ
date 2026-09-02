import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { NAV_REGISTRY } from "./nav-registry";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const appShellSource = readFileSync(
  join(root, "src/components/ironiq/app-shell.tsx"),
  "utf8",
);

describe("NAV_REGISTRY stays in sync with the real sidebar", () => {
  it("has every entry's {label, href} pair actually present in app-shell.tsx", () => {
    // The real, load-bearing check: a rename in one place without the
    // other should fail here, not silently make search find the wrong
    // page (or nothing) for months. Nav item literals in app-shell.tsx
    // are multi-line (`to:`, `label:`, `icon:`, and sometimes
    // `restrictedProduct:` each on their own line), with `label:`
    // always appearing shortly AFTER `to:` within the same object in
    // this codebase's actual style -- never before it, and never with
    // another item's `to:` in between. So: from each `to: "href"`
    // match, look forward for whichever comes first, this label or
    // another item's `to:` -- if the label comes first, it's genuinely
    // the same object; if a different item's `to:` comes first, this
    // href belongs to a different item than the label we're checking
    // for, and this occurrence doesn't count as a match.
    for (const entry of NAV_REGISTRY) {
      const hrefNeedle = `to: "${entry.href}"`;
      const labelNeedle = `label: "${entry.label}"`;
      let found = false;
      let searchFrom = 0;
      for (;;) {
        const hrefIdx = appShellSource.indexOf(hrefNeedle, searchFrom);
        if (hrefIdx === -1) break;
        const afterHref = hrefIdx + hrefNeedle.length;
        const nextLabelIdx = appShellSource.indexOf(labelNeedle, afterHref);
        const nextToIdx = appShellSource.indexOf('to: "', afterHref);
        if (
          nextLabelIdx !== -1 &&
          (nextToIdx === -1 || nextLabelIdx < nextToIdx)
        ) {
          found = true;
          break;
        }
        searchFrom = afterHref;
      }
      expect(
        found,
        `NAV_REGISTRY has {label: "${entry.label}", href: "${entry.href}"} but ` +
          `app-shell.tsx has no matching nav item -- either the registry is stale, ` +
          `or the real nav item was renamed/moved without updating nav-registry.ts.`,
      ).toBe(true);
    }
  });

  it("has no duplicate labels within the same section", () => {
    // Caught a real bug this way once already this session (a rename
    // that would have produced two items both labeled "Improvements" in
    // the same section) -- this test exists specifically so that class
    // of mistake can't happen silently again.
    const seen = new Map<string, Set<string>>();
    for (const entry of NAV_REGISTRY) {
      const labels = seen.get(entry.section) ?? new Set<string>();
      expect(
        labels.has(entry.label),
        `Duplicate label "${entry.label}" in section "${entry.section}"`,
      ).toBe(false);
      labels.add(entry.label);
      seen.set(entry.section, labels);
    }
  });
});
