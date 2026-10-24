export type DetectedLanguage = {
  language: string;
  direction: "rtl" | "ltr";
  script: string;
};

const RTL_LANGS = new Set(["ar", "he", "fa", "ur", "ps", "sd", "yi"]);

const RANGES: { script: string; language: string; re: RegExp }[] = [
  { script: "arabic", language: "ar", re: /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/ },
  { script: "hebrew", language: "he", re: /[\u0590-\u05FF]/ },
  { script: "cjk", language: "zh", re: /[\u4E00-\u9FFF]/ },
  { script: "hiragana", language: "ja", re: /[\u3040-\u309F]/ },
  { script: "katakana", language: "ja", re: /[\u30A0-\u30FF]/ },
  { script: "hangul", language: "ko", re: /[\uAC00-\uD7AF]/ },
  { script: "cyrillic", language: "ru", re: /[\u0400-\u04FF]/ },
  { script: "devanagari", language: "hi", re: /[\u0900-\u097F]/ },
  { script: "greek", language: "el", re: /[\u0370-\u03FF]/ },
  { script: "thai", language: "th", re: /[\u0E00-\u0E7F]/ },
];

export function detectLanguage(text: string): DetectedLanguage {
  const sample = text.slice(0, 2000);
  for (const range of RANGES) {
    const hits = sample.match(new RegExp(range.re, "g"));
    if (hits && hits.length >= 3) {
      return {
        language: range.language,
        direction: RTL_LANGS.has(range.language) ? "rtl" : "ltr",
        script: range.script,
      };
    }
  }
  if (RANGES[0].re.test(sample)) {
    return { language: "ar", direction: "rtl", script: "arabic" };
  }
  return { language: "en", direction: "ltr", script: "latin" };
}

export function isRtlLanguage(code?: string | null) {
  return !!code && RTL_LANGS.has(code);
}

export function localeDir(locale: string) {
  return isRtlLanguage(locale) ? "rtl" : "ltr";
}
