import { describe, expect, it } from "vitest";
import { parseCsvList, slugify, uniqueSlug } from "@/lib/utils";
import { appConfig } from "@/lib/config";

describe("helpers", () => {
  it("parses comma and newline lists", () => {
    expect(parseCsvList("open source, llama\nnextjs")).toEqual(["open source", "llama", "nextjs"]);
  });

  it("slugifies workspace names", () => {
    expect(slugify("Acme Labs!")).toBe("acme-labs");
    expect(uniqueSlug("Acme")).toMatch(/^acme-/);
  });

  it("defaults web search to Brave", () => {
    expect(appConfig.webSearchProvider).toBe("brave");
  });
});
