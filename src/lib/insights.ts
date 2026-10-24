export type SentimentCounts = {
  positive: number;
  neutral: number;
  negative: number;
};

export type VolumePoint = {
  date: string;
  volume: number;
};

export function sentimentMood(counts: SentimentCounts) {
  const total = counts.positive + counts.neutral + counts.negative;
  if (total === 0) {
    return { key: "none" as const, en: "We do not have enough mentions to read the mood yet.", ar: "لا توجد إشارات كافية لقراءة المزاج بعد." };
  }
  if (counts.positive >= counts.negative && counts.positive >= counts.neutral) {
    return { key: "positive" as const, en: "People sound mostly positive.", ar: "المزاج في الغالب إيجابي." };
  }
  if (counts.negative > counts.positive && counts.negative >= counts.neutral) {
    return { key: "negative" as const, en: "People sound mostly negative — worth a look today.", ar: "المزاج في الغالب سلبي — يستحق نظرة اليوم." };
  }
  return { key: "neutral" as const, en: "The conversation is mixed — neither clearly happy nor upset.", ar: "الحديث مختلط — لا هو سعيد بوضوح ولا منزعج." };
}

export function biggestSpike(series: VolumePoint[]) {
  if (!series.length) return null;
  const peak = series.reduce((best, row) => (row.volume > best.volume ? row : best), series[0]);
  if (peak.volume <= 0) return null;
  return peak;
}

export function formatDay(isoDate: string, locale = "en") {
  const date = new Date(`${isoDate}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return isoDate;
  return new Intl.DateTimeFormat(locale === "ar" ? "ar" : "en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(date);
}

export function homeHeadline(input: {
  todayCount: number;
  weekCount: number;
  mood: ReturnType<typeof sentimentMood>;
  spike: VolumePoint | null;
  locale: string;
}) {
  const loc = input.locale === "ar" ? "ar" : "en";
  if (loc === "ar") {
    const spike = input.spike
      ? ` أكبر ارتفاع كان يوم ${formatDay(input.spike.date, "ar")} بـ ${input.spike.volume} إشارة.`
      : "";
    return `${input.todayCount} إشارة جديدة اليوم، ${input.mood.ar}${spike}`;
  }
  const spike = input.spike
    ? ` The biggest spike was ${formatDay(input.spike.date, "en")} with ${input.spike.volume} mentions.`
    : "";
  return `${input.todayCount} new mention${input.todayCount === 1 ? "" : "s"} today, ${input.mood.en}${spike}`;
}

export function keywordSuggestions(brand: string) {
  const name = brand.trim();
  if (!name) {
    return ["your brand name", "your brand review", "customer service", "your app"];
  }
  return [name, `${name} review`, `${name} vs`, `${name} app`, "customer service"];
}
