import { describe, expect, it } from "vitest";
import { extractTopics } from "@/lib/sentiment";

describe("topics", () => {
  it("ranks recurring terms and keeps Arabic tokens", () => {
    const topics = extractTopics([
      "Next.js open source release with Next.js tooling",
      "open source الذكاء الاصطناعي nextjs",
    ]);
    expect(topics.some((t) => t.topic.includes("next") || t.topic.includes("source"))).toBe(true);
    expect(topics.some((t) => t.topic.includes("الذكاء") || t.topic.includes("الاصطناعي") || t.topic === "الذكاء")).toBe(true);
  });
});
