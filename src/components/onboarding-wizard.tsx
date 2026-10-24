"use client";

import { useMemo, useState } from "react";
import type { Source } from "@prisma/client";
import { completeOnboardingAction } from "@/lib/actions";
import { DEFAULT_ONBOARD_PLATFORMS, PLATFORMS } from "@/lib/platforms";
import { keywordSuggestions } from "@/lib/insights";
import { Button, Card, Field } from "@/components/ui";
import { PlatformLogo } from "@/components/platform-logo";

const STEPS = 5;

export function OnboardingWizard({ locale }: { locale: string }) {
  const ar = locale === "ar";
  const [step, setStep] = useState(1);
  const [brand, setBrand] = useState("");
  const [keywords, setKeywords] = useState("");
  const [competitors, setCompetitors] = useState("");
  const [sources, setSources] = useState<Source[]>(DEFAULT_ONBOARD_PLATFORMS);
  const suggestions = useMemo(() => keywordSuggestions(brand), [brand]);

  function toggle(id: Source) {
    setSources((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function addSuggestion(word: string) {
    const parts = keywords.split(",").map((item) => item.trim()).filter(Boolean);
    if (!parts.includes(word)) setKeywords([...parts, word].join(", "));
  }

  const copy = ar
    ? {
        title: ["سمِّ علامتك", "أضف كلمات للمراقبة", "أضف منافسين", "اختر المنصات", "شاهد أولى النتائج"],
        help: [
          "هذا الاسم يظهر في الرئيسية والتقارير. يمكن أن يكون منتجاً أو شركة.",
          "سنبحث عن هذه الكلمات في المواقع الجاهزة الآن. أمثلة: اسم العلامة، اسم المنتج، شكوى شائعة.",
          "اختياري. اكتب أسماء الشركات التي تتابعها — حتى لو لم نتمكن من مراقبتها على كل منصة.",
          "الأخضر يعمل فوراً. الباقي يحتاج ربط حساب لاحقاً.",
          "بعد الحفظ نبحث فوراً ونأخذك إلى الرئيسية.",
        ],
        brand: "اسم العلامة",
        words: "كلمات للمراقبة",
        competitors: "المنافسون (اختياري)",
        next: "متابعة",
        back: "رجوع",
        finish: "ابحث عن إشاراتي",
        ready: "يعمل الآن",
        later: "يحتاج ربطاً",
      }
    : {
        title: ["Name your brand", "Add words to watch", "Add competitors", "Pick platforms", "See first results"],
        help: [
          "This name appears on Home and in reports. It can be a product, a company, or a campaign.",
          "We search public sites for these words. Try your brand, a product name, or a common complaint.",
          "Optional. Type company names you care about — even if some sites cannot watch competitors.",
          "Green tiles work right away. The others need a connected account later.",
          "When you save, we search immediately and take you to Home.",
        ],
        brand: "Brand name",
        words: "Words to watch",
        competitors: "Competitors (optional)",
        next: "Continue",
        back: "Back",
        finish: "Find my mentions",
        ready: "Works now",
        later: "Needs connecting",
      };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-accent">
          {ar ? `خطوة ${step} من ${STEPS}` : `Step ${step} of ${STEPS}`}
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">{copy.title[step - 1]}</h1>
        <p className="mt-2 text-sm text-muted">{copy.help[step - 1]}</p>
        <div className="mt-4 flex gap-1.5">
          {Array.from({ length: STEPS }, (_, i) => (
            <span key={i} className={`h-1.5 flex-1 rounded-full ${i < step ? "bg-accent" : "bg-bg-soft"}`} />
          ))}
        </div>
      </div>

      <Card>
        {step === 1 && (
          <Field label={copy.brand} hint={ar ? "مثال: أكمي، تطبيقنا، حملة الصيف" : "Example: Acme, our app, Summer launch"}>
            <input name="brand" value={brand} onChange={(e) => setBrand(e.target.value)} placeholder={ar ? "أكمي" : "Acme"} required />
          </Field>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <Field label={copy.words} hint={ar ? "افصل الكلمات بفاصلة. العربية والإنجليزية تعملان." : "Separate words with commas. Arabic and English both work."}>
              <input
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                placeholder={ar ? "أكمي، مراجعة أكمي، ذكاء اصطناعي" : "Acme, Acme review, customer service"}
              />
            </Field>
            <div>
              <p className="mb-2 text-sm text-muted">{ar ? "اقتراحات — اضغط لإضافة واحدة" : "Suggestions — tap to add one"}</p>
              <div className="flex flex-wrap gap-2">
                {suggestions.map((word) => (
                  <button
                    key={word}
                    type="button"
                    onClick={() => addSuggestion(word)}
                    className="rounded-full border border-line px-3 py-1 text-sm hover:border-accent"
                  >
                    {word}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <Field label={copy.competitors} hint={ar ? "مثال: شركة منافسة، @handle" : "Example: a rival company, @handle"}>
            <input value={competitors} onChange={(e) => setCompetitors(e.target.value)} placeholder={ar ? "منافس، علامة أخرى" : "Rival Co, otherbrand"} />
          </Field>
        )}

        {step === 4 && (
          <div className="grid gap-2 sm:grid-cols-2">
            {PLATFORMS.filter((p) => p.id !== "GOOGLE_TRENDS").map((platform) => {
              const checked = sources.includes(platform.id);
              return (
                <label key={platform.id} className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-3 ${checked ? "border-accent bg-accent/5" : "border-line"}`}>
                  <input
                    type="checkbox"
                    className="mt-1 w-auto"
                    checked={checked}
                    onChange={() => toggle(platform.id)}
                  />
                  <PlatformLogo id={platform.id} />
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2 font-medium">
                      {ar ? platform.nameAr : platform.name}
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${platform.readyNow ? "bg-good/15 text-good" : "bg-warn/15 text-warn"}`}>
                        {platform.readyNow ? copy.ready : copy.later}
                      </span>
                    </span>
                    <span className="mt-0.5 block text-xs text-muted">{ar ? platform.blurbAr : platform.blurb}</span>
                  </span>
                </label>
              );
            })}
          </div>
        )}

        {step === 5 && (
          <div className="space-y-3 text-sm">
            <p className="text-lg font-semibold">{brand || (ar ? "علامتك" : "Your brand")}</p>
            <p className="text-muted">
              {ar ? "كلمات المراقبة:" : "Words to watch:"} {keywords || (ar ? "لم تُضف بعد" : "none yet")}
            </p>
            <p className="text-muted">
              {ar ? "المنافسون:" : "Competitors:"} {competitors || (ar ? "لا يوجد" : "none")}
            </p>
            <p className="text-muted">
              {ar ? "المنصات:" : "Platforms:"} {sources.length}
            </p>
            <p>{ar ? "اضغط الزر وسنبحث الآن. قد تستغرق النتائج الأولى دقيقة." : "Hit the button and we will search now. First results can take about a minute."}</p>
          </div>
        )}

        <div className="mt-6 flex justify-between gap-2">
          <Button type="button" variant="ghost" disabled={step === 1} onClick={() => setStep((s) => Math.max(1, s - 1))}>
            {copy.back}
          </Button>
          {step < STEPS ? (
            <Button
              type="button"
              onClick={() => setStep((s) => Math.min(STEPS, s + 1))}
              disabled={(step === 1 && !brand.trim()) || (step === 2 && !keywords.trim())}
            >
              {copy.next}
            </Button>
          ) : (
            <form action={completeOnboardingAction}>
              <input type="hidden" name="name" value={brand} />
              <input type="hidden" name="keywords" value={keywords} />
              <input type="hidden" name="competitors" value={competitors} />
              {sources.map((id) => (
                <input key={id} type="hidden" name="sources" value={id} />
              ))}
              <Button type="submit">{copy.finish}</Button>
            </form>
          )}
        </div>
      </Card>
    </div>
  );
}
