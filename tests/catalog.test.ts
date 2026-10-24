import { describe, expect, it } from "vitest";
import { SOURCE_CATALOG } from "@/lib/connectors/catalog";
import { listConnectors } from "@/lib/connectors/registry";

describe("connector catalog", () => {
  it("covers every registered connector", () => {
    const ids = listConnectors().map((c) => c.id).sort();
    const catalog = SOURCE_CATALOG.map((c) => c.id).sort();
    expect(ids).toEqual(catalog);
  });

  it("marks LinkedIn and TikTok competitor tracking as unavailable", () => {
    const li = SOURCE_CATALOG.find((s) => s.id === "LINKEDIN")!;
    const tt = SOURCE_CATALOG.find((s) => s.id === "TIKTOK")!;
    expect(li.capabilities.find((c) => c.key === "competitor_track")?.available).toBe(false);
    expect(tt.capabilities.find((c) => c.key === "competitor_track")?.available).toBe(false);
    expect(li.capabilities.find((c) => c.key === "keyword_search")?.available).toBe(false);
  });

  it("documents Instagram hashtag quota and X pay-per-use", () => {
    const ig = SOURCE_CATALOG.find((s) => s.id === "INSTAGRAM")!;
    const x = SOURCE_CATALOG.find((s) => s.id === "X")!;
    expect(ig.capabilities.find((c) => c.key === "hashtag_search")?.limitation).toMatch(/30 unique/);
    expect(x.notes.join(" ")).toMatch(/pay-per-use/i);
  });

  it("does not use Google Custom Search as the web provider", () => {
    const web = SOURCE_CATALOG.find((s) => s.id === "WEB_SEARCH")!;
    expect(web.notes.join(" ")).toMatch(/brave/i);
    expect(web.notes.join(" ")).toMatch(/1 Jan 2027/);
  });
});
