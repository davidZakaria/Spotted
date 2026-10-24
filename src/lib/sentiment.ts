import { Sentiment } from "@prisma/client";
import { appConfig } from "./config";
import { detectLanguage } from "./language";

const EN_POS = [
  "love", "great", "amazing", "excellent", "awesome", "good", "best", "fantastic",
  "wonderful", "happy", "thanks", "thank", "helpful", "beautiful", "perfect",
  "recommend", "impressive", "win", "success", "excited", "delight", "brilliant",
];
const EN_NEG = [
  "hate", "terrible", "awful", "worst", "bad", "poor", "broken", "bug", "scam",
  "fraud", "angry", "disappointed", "useless", "slow", "fail", "failure", "crash",
  "horrible", "pain", "issue", "problem", "refund", "overpriced",
];
const AR_POS = [
  "رائع", "ممتاز", "جيد", "حب", "أحب", "جميل", "موفق", "شكرا", "شكراً", "مفيد",
  "أفضل", "مذهل", "سعيد", "أنصح", "قوي", "نجاح",
];
const AR_NEG = [
  "سيء", "سئ", "فظيع", "أكره", "مشكلة", "فاشل", "فشل", "بطيء", "احتيال", "غالي",
  "سيئة", "أسوأ", "مخيب", "ضعيف", "خطأ", "أعطال",
];

function scoreLexicon(text: string) {
  const lower = text.toLowerCase();
  let score = 0;
  for (const w of EN_POS) if (lower.includes(w)) score += 1;
  for (const w of EN_NEG) if (lower.includes(w)) score -= 1;
  for (const w of AR_POS) if (text.includes(w)) score += 1;
  for (const w of AR_NEG) if (text.includes(w)) score -= 1;
  return score;
}

export function classifyScore(score: number): { sentiment: Sentiment; sentimentScore: number } {
  if (score >= 1) return { sentiment: "POSITIVE", sentimentScore: Math.min(1, score / 5) };
  if (score <= -1) return { sentiment: "NEGATIVE", sentimentScore: Math.max(-1, score / 5) };
  return { sentiment: "NEUTRAL", sentimentScore: 0 };
}

export function analyzeSentimentLocal(text: string) {
  return classifyScore(scoreLexicon(text));
}

export async function analyzeSentiment(text: string) {
  if (appConfig.openaiKey) {
    try {
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
                "Classify social mention sentiment. Reply JSON only: {\"sentiment\":\"POSITIVE|NEUTRAL|NEGATIVE\",\"score\":number}. Score is -1 to 1. Support Arabic and other languages.",
            },
            { role: "user", content: `language=${lang}\n${text.slice(0, 2000)}` },
          ],
        }),
      });
      if (res.ok) {
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
    } catch {
      // fall through to lexicon
    }
  }
  return analyzeSentimentLocal(text);
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
