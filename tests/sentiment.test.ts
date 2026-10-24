import { describe, expect, it } from "vitest";
import { analyzeSentimentLocal } from "@/lib/sentiment";

describe("sentiment", () => {
  it("scores English positive and negative", () => {
    expect(analyzeSentimentLocal("This is amazing and excellent, I love it").sentiment).toBe("POSITIVE");
    expect(analyzeSentimentLocal("This is terrible and the worst broken scam").sentiment).toBe("NEGATIVE");
  });

  it("scores Arabic positive and negative", () => {
    expect(analyzeSentimentLocal("منتج رائع وممتاز وأنا أحب هذه الخدمة").sentiment).toBe("POSITIVE");
    expect(analyzeSentimentLocal("تجربة سيئة وفظيعة هذا فشل ضعيف").sentiment).toBe("NEGATIVE");
  });
});
