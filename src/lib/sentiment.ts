import { Sentiment } from "@prisma/client";
import { appConfig } from "./config";
import { detectLanguage } from "./language";
import { normalizeText } from "./listen/query";

export type SentimentResult = {
  sentiment: Sentiment;
  sentimentScore: number;
  complaint: boolean;
};

type LexTerm = {
  term: string;
  weight: number;
  polarity: 1 | -1;
  risk?: boolean;
};

const EN_POS = [
  "love", "great", "amazing", "excellent", "awesome", "good", "best", "fantastic",
  "wonderful", "happy", "thanks", "thank", "helpful", "beautiful", "perfect",
  "recommend", "impressive", "win", "success", "excited", "delight", "brilliant",
];
const AR_POS = [
  "رائع", "ممتاز", "جيد", "حب", "أحب", "جميل", "موفق", "شكرا", "شكراً", "مفيد",
  "أفضل", "مذهل", "سعيد", "أنصح", "قوي", "نجاح", "محترم",
];

const EN_NEG: LexTerm[] = [
  { term: "class action", weight: 3, polarity: -1, risk: true },
  { term: "legal action", weight: 3, polarity: -1, risk: true },
  { term: "never delivered", weight: 3, polarity: -1, risk: true },
  { term: "breach of contract", weight: 3, polarity: -1, risk: true },
  { term: "delivery delayed", weight: 2, polarity: -1, risk: true },
  { term: "delayed delivery", weight: 2, polarity: -1, risk: true },
  { term: "rip-off", weight: 2, polarity: -1, risk: true },
  { term: "ripoff", weight: 2, polarity: -1, risk: true },
  { term: "scammers", weight: 3, polarity: -1, risk: true },
  { term: "scammer", weight: 3, polarity: -1, risk: true },
  { term: "lawsuit", weight: 3, polarity: -1, risk: true },
  { term: "lawsuits", weight: 3, polarity: -1, risk: true },
  { term: "fraudulent", weight: 3, polarity: -1, risk: true },
  { term: "fraud", weight: 3, polarity: -1, risk: true },
  { term: "scam", weight: 3, polarity: -1, risk: true },
  { term: "swindle", weight: 3, polarity: -1, risk: true },
  { term: "stolen", weight: 3, polarity: -1, risk: true },
  { term: "theft", weight: 3, polarity: -1, risk: true },
  { term: "cheated", weight: 2, polarity: -1, risk: true },
  { term: "refunds", weight: 2, polarity: -1, risk: true },
  { term: "refund", weight: 2, polarity: -1, risk: true },
  { term: "attorney", weight: 2, polarity: -1, risk: true },
  { term: "sued", weight: 3, polarity: -1, risk: true },
  { term: "worst", weight: 2, polarity: -1 },
  { term: "delayed", weight: 2, polarity: -1 },
  { term: "delays", weight: 2, polarity: -1 },
  { term: "delay", weight: 2, polarity: -1 },
  { term: "hate", weight: 1, polarity: -1 },
  { term: "terrible", weight: 1, polarity: -1 },
  { term: "awful", weight: 1, polarity: -1 },
  { term: "bad", weight: 1, polarity: -1 },
  { term: "poor", weight: 1, polarity: -1 },
  { term: "broken", weight: 1, polarity: -1 },
  { term: "bug", weight: 1, polarity: -1 },
  { term: "angry", weight: 1, polarity: -1 },
  { term: "disappointed", weight: 1, polarity: -1 },
  { term: "useless", weight: 1, polarity: -1 },
  { term: "slow", weight: 1, polarity: -1 },
  { term: "failure", weight: 1, polarity: -1 },
  { term: "fail", weight: 1, polarity: -1 },
  { term: "crash", weight: 1, polarity: -1 },
  { term: "horrible", weight: 1, polarity: -1 },
  { term: "pain", weight: 1, polarity: -1 },
  { term: "issue", weight: 1, polarity: -1 },
  { term: "problem", weight: 1, polarity: -1 },
  { term: "overpriced", weight: 1, polarity: -1 },
];

const AR_NEG: LexTerm[] = [
  { term: "الرقابة الإدارية", weight: 3, polarity: -1, risk: true },
  { term: "حماية المستهلك", weight: 3, polarity: -1, risk: true },
  { term: "نصيحة متتعاملوش", weight: 3, polarity: -1, risk: true },
  { term: "متعاملوش", weight: 3, polarity: -1, risk: true },
  { term: "تأخير التسليم", weight: 3, polarity: -1, risk: true },
  { term: "تأخر التسليم", weight: 3, polarity: -1, risk: true },
  { term: "فسخ العقد", weight: 3, polarity: -1, risk: true },
  { term: "غير محترم", weight: 2, polarity: -1 },
  { term: "غير محترمين", weight: 2, polarity: -1 },
  { term: "متضررين", weight: 3, polarity: -1, risk: true },
  { term: "متضررو", weight: 3, polarity: -1, risk: true },
  { term: "متضرري", weight: 3, polarity: -1, risk: true },
  { term: "متضرر", weight: 3, polarity: -1, risk: true },
  { term: "استغاثة", weight: 3, polarity: -1, risk: true },
  { term: "شكاوى", weight: 3, polarity: -1, risk: true },
  { term: "شكوي", weight: 3, polarity: -1, risk: true },
  { term: "شكوى", weight: 3, polarity: -1, risk: true },
  { term: "قضايا", weight: 3, polarity: -1, risk: true },
  { term: "قضية", weight: 3, polarity: -1, risk: true },
  { term: "نصابين", weight: 3, polarity: -1, risk: true },
  { term: "نصاب", weight: 3, polarity: -1, risk: true },
  { term: "نصبوا", weight: 3, polarity: -1, risk: true },
  { term: "نصب", weight: 3, polarity: -1, risk: true },
  { term: "حرامية", weight: 3, polarity: -1, risk: true },
  { term: "حرامي", weight: 3, polarity: -1, risk: true },
  { term: "سرقة", weight: 3, polarity: -1, risk: true },
  { term: "سرقوا", weight: 3, polarity: -1, risk: true },
  { term: "مبتسلمش", weight: 3, polarity: -1, risk: true },
  { term: "مبتردوش", weight: 3, polarity: -1, risk: true },
  { term: "مبيردوش", weight: 3, polarity: -1, risk: true },
  { term: "مش بيردوا", weight: 3, polarity: -1, risk: true },
  { term: "ما بيردوش", weight: 3, polarity: -1, risk: true },
  { term: "احتيال", weight: 3, polarity: -1, risk: true },
  { term: "محتالين", weight: 3, polarity: -1, risk: true },
  { term: "محتال", weight: 3, polarity: -1, risk: true },
  { term: "بلطجة", weight: 3, polarity: -1, risk: true },
  { term: "ضحايا", weight: 3, polarity: -1, risk: true },
  { term: "بلاغ", weight: 3, polarity: -1, risk: true },
  { term: "محضر", weight: 3, polarity: -1, risk: true },
  { term: "فلوسنا", weight: 3, polarity: -1, risk: true },
  { term: "استرداد", weight: 3, polarity: -1, risk: true },
  { term: "خداع", weight: 2, polarity: -1, risk: true },
  { term: "فضيحة", weight: 2, polarity: -1, risk: true },
  { term: "حقوقي", weight: 2, polarity: -1, risk: true },
  { term: "حقي", weight: 2, polarity: -1, risk: true },
  { term: "بجاحة", weight: 2, polarity: -1 },
  { term: "حفرة", weight: 2, polarity: -1 },
  { term: "أسوأ", weight: 2, polarity: -1 },
  { term: "سيئة", weight: 1, polarity: -1 },
  { term: "سيء", weight: 1, polarity: -1 },
  { term: "سئ", weight: 1, polarity: -1 },
  { term: "فظيع", weight: 1, polarity: -1 },
  { term: "أكره", weight: 1, polarity: -1 },
  { term: "مشكلة", weight: 1, polarity: -1 },
  { term: "فاشلة", weight: 1, polarity: -1 },
  { term: "فاشل", weight: 1, polarity: -1 },
  { term: "فشل", weight: 1, polarity: -1 },
  { term: "وحشة", weight: 1, polarity: -1 },
  { term: "زفت", weight: 1, polarity: -1 },
  { term: "هبل", weight: 1, polarity: -1 },
  { term: "متأخرة", weight: 2, polarity: -1 },
  { term: "بطيء", weight: 1, polarity: -1 },
  { term: "غالي", weight: 1, polarity: -1 },
  { term: "مخيب", weight: 1, polarity: -1 },
  { term: "ضعيف", weight: 1, polarity: -1 },
  { term: "خطأ", weight: 1, polarity: -1 },
  { term: "أعطال", weight: 1, polarity: -1 },
  { term: "كذب", weight: 1, polarity: -1 },
  { term: "كدب", weight: 1, polarity: -1 },
  { term: "غش", weight: 2, polarity: -1, risk: true },
  { term: "ظلم", weight: 2, polarity: -1, risk: true },
  { term: "تأخير", weight: 2, polarity: -1 },
  { term: "تأخر", weight: 2, polarity: -1 },
];

const NEGATION = [
  "not", "no", "never", "isn't", "isnt", "aren't", "arent", "wasn't", "wasnt",
  "weren't", "werent", "don't", "dont", "doesn't", "doesnt", "didn't", "didnt",
  "without", "neither",
  "مش", "ليس", "ليست", "مفيش", "بدون", "ما", "لا",
];

function compileTerms(): LexTerm[] {
  const out: LexTerm[] = [];
  for (const term of EN_POS) out.push({ term, weight: 1, polarity: 1 });
  for (const term of AR_POS) out.push({ term, weight: 1, polarity: 1 });
  out.push(...EN_NEG, ...AR_NEG);
  return out
    .map((item) => ({ ...item, term: normalizeText(item.term) }))
    .filter((item) => item.term.length > 0)
    .sort((a, b) => b.term.length - a.term.length);
}

const TERMS = compileTerms();
const NEGATION_NORM = NEGATION.map(normalizeText).filter(Boolean).sort((a, b) => b.length - a.length);

function isNegated(hay: string, start: number) {
  const window = hay.slice(Math.max(0, start - 24), start);
  return NEGATION_NORM.some((neg) => {
    const idx = window.lastIndexOf(neg);
    if (idx < 0) return false;
    const before = idx === 0 ? "" : window[idx - 1] ?? "";
    if (before && LETTER.test(before) && before !== "و") return false;
    const after = window.slice(idx + neg.length);
    return /^(?:\s|a|an|the|هذا|هذه|و)*$/u.test(after);
  });
}

function overlaps(used: [number, number][], start: number, end: number) {
  return used.some(([from, to]) => start < to && end > from);
}

const LETTER = /[\p{L}\p{N}]/u;

function isStartBounded(hay: string, start: number) {
  if (start === 0) return true;
  return !LETTER.test(hay[start - 1] ?? "");
}

function isEndBounded(hay: string, end: number, latin: boolean) {
  if (!latin) return true;
  if (end >= hay.length) return true;
  return !LETTER.test(hay[end] ?? "");
}

export function scoreSentiment(text: string) {
  const hay = normalizeText(text);
  let score = 0;
  let complaint = false;
  const used: [number, number][] = [];
  for (const item of TERMS) {
    let from = 0;
    let hits = 0;
    while (hits < 8) {
      const idx = hay.indexOf(item.term, from);
      if (idx < 0) break;
      const end = idx + item.term.length;
      from = idx + Math.max(item.term.length, 1);
      const latin = /^[a-z0-9]/.test(item.term);
      if (!isStartBounded(hay, idx) || !isEndBounded(hay, end, latin)) continue;
      if (overlaps(used, idx, end)) continue;
      used.push([idx, end]);
      hits += 1;
      const negated = isNegated(hay, idx);
      if (negated) {
        if (item.polarity === 1) score -= 1;
        continue;
      }
      score += item.polarity * item.weight;
      if (item.risk) complaint = true;
    }
  }
  return { score, complaint };
}

export function classifyScore(score: number): { sentiment: Sentiment; sentimentScore: number } {
  if (score >= 1) return { sentiment: "POSITIVE", sentimentScore: Math.min(1, score / 5) };
  if (score <= -1) return { sentiment: "NEGATIVE", sentimentScore: Math.max(-1, score / 5) };
  return { sentiment: "NEUTRAL", sentimentScore: 0 };
}

export function isComplaintRisk(text: string) {
  return scoreSentiment(text).complaint;
}

export function analyzeSentimentLocal(text: string): SentimentResult {
  const { score, complaint } = scoreSentiment(text);
  const classified = classifyScore(score);
  return { ...classified, complaint };
}

async function classifyOpenAI(text: string): Promise<Omit<SentimentResult, "complaint"> | null> {
  const lang = detectLanguage(text).language;
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${appConfig.openaiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: appConfig.openaiModel,
      temperature: 0,
      messages: [
        {
          role: "system",
          content:
            "Classify social mention sentiment. Reply JSON only: {\"sentiment\":\"POSITIVE|NEUTRAL|NEGATIVE\",\"score\":number}. Score is -1 to 1. Support Arabic (including Egyptian dialect) and other languages. Treat scam, fraud, lawsuit, نصب, نصاب, استغاثة, شكوى, متضرر, فسخ العقد, تأخير التسليم as NEGATIVE.",
        },
        { role: "user", content: `language=${lang}\n${text.slice(0, 2000)}` },
      ],
    }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content ?? "";
  const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
  const sentiment = ["POSITIVE", "NEUTRAL", "NEGATIVE"].includes(parsed.sentiment)
    ? parsed.sentiment
    : "NEUTRAL";
  return {
    sentiment: sentiment as Sentiment,
    sentimentScore: Number(parsed.score) || 0,
  };
}

export async function analyzeSentiment(text: string): Promise<SentimentResult> {
  const local = analyzeSentimentLocal(text);
  if (appConfig.openaiKey) {
    try {
      const remote = await classifyOpenAI(text);
      if (remote) {
        if (local.sentiment === "NEGATIVE" || local.complaint) {
          if (remote.sentiment === "NEGATIVE") {
            return {
              sentiment: "NEGATIVE",
              sentimentScore: Math.min(local.sentimentScore, remote.sentimentScore || local.sentimentScore),
              complaint: local.complaint,
            };
          }
          return local;
        }
        return { ...remote, complaint: false };
      }
    } catch {
      // fall through to lexicon
    }
  }
  return local;
}

const STOP = new Set([
  "the", "and", "for", "that", "with", "this", "from", "have", "was", "are",
  "you", "your", "but", "not", "all", "can", "our", "their", "about", "just",
  "http", "https", "www", "com", "من", "في", "على", "هذا", "هذه", "ذلك",
]);

export function extractTopics(texts: string[], limit = 8) {
  const counts = new Map<string, number>();
  for (const text of texts) {
    const tokens = text
      .toLowerCase()
      .replace(/https?:\/\/\S+/g, "")
      .split(/[^\p{L}\p{N}#]+/u)
      .filter((t) => t.length > 2 && !STOP.has(t));
    for (const token of tokens) counts.set(token, (counts.get(token) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([topic, count]) => ({ topic, count }));
}
