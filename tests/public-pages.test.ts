import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { isPublicPath, PUBLIC_LEGAL_PATHS } from "@/lib/public-paths";

const PAGES = [
  { path: "/privacy", file: "src/app/privacy/page.tsx" },
  { path: "/terms", file: "src/app/terms/page.tsx" },
  { path: "/data-deletion", file: "src/app/data-deletion/page.tsx" },
];

describe("public legal pages", () => {
  it("treats privacy, terms, and data deletion as public", () => {
    for (const path of PUBLIC_LEGAL_PATHS) {
      expect(isPublicPath(path)).toBe(true);
    }
    expect(isPublicPath("/app")).toBe(false);
    expect(isPublicPath("/app/settings")).toBe(false);
  });

  it("does not require a login and is readable as HTML", () => {
    for (const page of PAGES) {
      const src = readFileSync(resolve(page.file), "utf8");
      expect(src, page.file).not.toMatch(/requireSession|redirect\("\/login"\)/);
      expect(src).toMatch(/export default function/);
      expect(src).toMatch(/LegalPage/);
    }
  });

  it("tells people how to delete data and who to email", () => {
    const src = readFileSync(resolve("src/app/data-deletion/page.tsx"), "utf8");
    expect(src).toContain("davidsamii97@gmail.com");
    expect(src).toMatch(/Delete my Spotted data/);
    expect(src).toMatch(/30 days/);
  });

  it("keeps middleware off the legal routes so Meta can crawl them", () => {
    const src = readFileSync(resolve("src/middleware.ts"), "utf8");
    expect(src).toMatch(/isPublicPath/);
    expect(src).toMatch(/matcher:\s*\[\s*"\/app\/:path\*"/);
    expect(src).not.toMatch(/"\/privacy"/);
    expect(src).not.toMatch(/matcher:.*privacy|terms|data-deletion/);
  });

  it("links the pages from the shared footer", () => {
    const footer = readFileSync(resolve("src/components/site-footer.tsx"), "utf8");
    for (const path of PUBLIC_LEGAL_PATHS) {
      expect(footer).toContain(`href: "${path}"`);
    }
  });
});
