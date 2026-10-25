import { describe, expect, it } from "vitest";
import { detectLanguage, isRtlLanguage } from "@/lib/language";

describe("language detection", () => {
  it("detects Arabic and marks RTL", () => {
    const d = detectLanguage("هذا منتج رائع وأنا أحب التجربة اليومية جداً");
    expect(d.language).toBe("ar");
    expect(d.direction).toBe("rtl");
    expect(isRtlLanguage("ar")).toBe(true);
    expect(detectLanguage("إعلان عن J-Communities في القاهرة").language).toBe("ar");
    expect(detectLanguage("هَذَا مُنْتَجٌ جَيِّد").language).toBe("ar");
  });

  it("detects English as LTR", () => {
    const d = detectLanguage("This open source release is genuinely impressive and useful.");
    expect(d.language).toBe("en");
    expect(d.direction).toBe("ltr");
  });
});
