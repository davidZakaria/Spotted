import { describe, expect, it } from "vitest";
import { detectLanguage, isRtlLanguage } from "@/lib/language";

describe("language detection", () => {
  it("detects Arabic and marks RTL", () => {
    const d = detectLanguage("هذا منتج رائع وأنا أحب التجربة اليومية جداً");
    expect(d.language).toBe("ar");
    expect(d.direction).toBe("rtl");
    expect(isRtlLanguage("ar")).toBe(true);
  });

  it("detects English as LTR", () => {
    const d = detectLanguage("This open source release is genuinely impressive and useful.");
    expect(d.language).toBe("en");
    expect(d.direction).toBe("ltr");
  });
});
