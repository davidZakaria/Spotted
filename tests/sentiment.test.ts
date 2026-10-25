import { describe, expect, it } from "vitest";
import { analyzeSentimentLocal, isComplaintRisk } from "@/lib/sentiment";

describe("sentiment", () => {
  it("scores English positive and negative", () => {
    expect(analyzeSentimentLocal("This is amazing and excellent, I love it").sentiment).toBe("POSITIVE");
    expect(analyzeSentimentLocal("This is terrible and the worst broken scam").sentiment).toBe("NEGATIVE");
  });

  it("scores Arabic positive and negative", () => {
    expect(analyzeSentimentLocal("منتج رائع وممتاز وأنا أحب هذه الخدمة").sentiment).toBe("POSITIVE");
    expect(analyzeSentimentLocal("تجربة سيئة وفظيعة هذا فشل ضعيف").sentiment).toBe("NEGATIVE");
  });

  it("flags Egyptian complaint headlines as negative with Complaints & risk", () => {
    const masr = analyzeSentimentLocal("متضررو نيو جيرسي يتحدثون عن نصب وفشل وبجاحة");
    expect(masr.sentiment).toBe("NEGATIVE");
    expect(masr.complaint).toBe(true);
    expect(isComplaintRisk("متضررو نيو جيرسي ... نصب وفشل وبجاحة")).toBe(true);

    const genesis = analyzeSentimentLocal("تأخير تسليم مشروع Genesis إلى 2030 بعد فسخ العقد");
    expect(genesis.sentiment).toBe("NEGATIVE");
    expect(genesis.complaint).toBe(true);

    const delayEn = analyzeSentimentLocal("Genesis delivery delayed to 2030, buyers demand a refund");
    expect(delayEn.sentiment).toBe("NEGATIVE");
    expect(delayEn.complaint).toBe(true);
  });

  it("understands Egyptian dialect complaint patterns", () => {
    expect(analyzeSentimentLocal("نصيحة متتعاملوش معاهم مبتردوش على حد").sentiment).toBe("NEGATIVE");
    expect(analyzeSentimentLocal("نصاب وحرامي وسرقة واستغاثة").complaint).toBe(true);
    expect(analyzeSentimentLocal("شكوى وقضايا وفسخ العقد وحقي ضاع").complaint).toBe(true);
    expect(analyzeSentimentLocal("غير محترم وحفرة في المشروع").sentiment).toBe("NEGATIVE");
    expect(isComplaintRisk("fraud lawsuit scam استغاثة")).toBe(true);
    expect(isComplaintRisk("تحقيق جديد في الساحل الشمالي")).toBe(false);
  });

  it("is negation-aware for simple English and Arabic", () => {
    expect(analyzeSentimentLocal("this is not a scam and not the worst").sentiment).not.toBe("NEGATIVE");
    expect(analyzeSentimentLocal("this is not a scam").complaint).toBe(false);
    expect(analyzeSentimentLocal("المشروع مش سيء وليس فشلا").sentiment).not.toBe("NEGATIVE");
    expect(analyzeSentimentLocal("ليس نصبا وليس احتيالا").complaint).toBe(false);
  });
});
