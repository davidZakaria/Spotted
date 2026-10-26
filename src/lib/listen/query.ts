import type { MatchType } from "@prisma/client";

export type KeywordRule = {
  phrase: string;
  matchType?: MatchType | "CONTAINS" | "EXACT" | "PHRASE";
  requiredWords?: string[];
  excludedWords?: string[];
  booleanQuery?: string | null;
  language?: string | null;
  country?: string | null;
  synonyms?: string[];
  requiredAny?: string[];
  requiredAnyWhen?: string[];
  autoVariants?: boolean;
};

const ARABIC_AND = /^(و|and)$/i;
const ARABIC_OR = /^(أو|او|or)$/i;
const ARABIC_NOT = /^(ليس|not)$/i;

const ARABIC_MARKS = /[\u0610-\u061A\u0640\u064B-\u065F\u0670\u06D6-\u06ED]/g;
const ARABIC_LETTER = /[\u0621-\u063A\u0641-\u064A]/;

export function isArabicText(value: string) {
  return ARABIC_LETTER.test(value);
}

export function normalizeText(input: string) {
  return input
    .toLowerCase()
    .replace(ARABIC_MARKS, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[-–—_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function expandVariants(term: string): string[] {
  const raw = term.trim();
  if (!raw) return [];
  const set = new Set<string>();
  const add = (value: string) => {
    const trimmed = value.trim();
    if (trimmed) set.add(trimmed);
  };
  add(raw);
  add(raw.replace(/[-–—_]+/g, " "));
  add(raw.replace(/\s+/g, "-"));
  add(raw.replace(/[-–—_\s]+/g, ""));
  add(raw.replace(/[-–—_\s]+/g, " "));
  add(normalizeText(raw));
  add(raw.replace(/[أإآٱ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه"));
  return [...set];
}

export function arabicTerms(rule: Pick<KeywordRule, "phrase" | "synonyms">) {
  return [...new Set([rule.phrase, ...(rule.synonyms ?? [])].map((term) => term.trim()).filter((term) => term && isArabicText(term)))];
}

export function searchQueries(rule: KeywordRule, max = 8): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const add = (value?: string | null) => {
    const trimmed = value?.trim();
    if (!trimmed || seen.has(trimmed)) return;
    seen.add(trimmed);
    out.push(trimmed);
  };
  if (rule.booleanQuery?.trim()) add(rule.booleanQuery);
  const bases = [rule.phrase, ...(rule.synonyms ?? [])];
  for (const base of bases) add(base);
  if (rule.autoVariants !== false) {
    for (const base of bases) expandVariants(base).forEach(add);
  }
  if (rule.requiredWords?.length) {
    add(`${rule.phrase} ${rule.requiredWords.join(" ")}`);
  }
  return out.slice(0, max);
}

type Token =
  | { kind: "and" }
  | { kind: "or" }
  | { kind: "not" }
  | { kind: "lparen" }
  | { kind: "rparen" }
  | { kind: "term"; value: string };

function tokenizeBoolean(input: string): Token[] {
  const tokens: Token[] = [];
  const src = input.trim();
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }
    if (ch === "(") {
      tokens.push({ kind: "lparen" });
      i += 1;
      continue;
    }
    if (ch === ")") {
      tokens.push({ kind: "rparen" });
      i += 1;
      continue;
    }
    if (ch === '"' || ch === "“" || ch === "”") {
      i += 1;
      let buf = "";
      while (i < src.length && src[i] !== '"' && src[i] !== "”") {
        buf += src[i];
        i += 1;
      }
      if (i < src.length) i += 1;
      tokens.push({ kind: "term", value: buf });
      continue;
    }
    let word = "";
    while (i < src.length && !/\s/.test(src[i]) && src[i] !== "(" && src[i] !== ")") {
      word += src[i];
      i += 1;
    }
    if (ARABIC_AND.test(word)) tokens.push({ kind: "and" });
    else if (ARABIC_OR.test(word)) tokens.push({ kind: "or" });
    else if (ARABIC_NOT.test(word)) tokens.push({ kind: "not" });
    else tokens.push({ kind: "term", value: word });
  }
  return tokens;
}

function evalBoolean(haystack: string, query: string) {
  const tokens = tokenizeBoolean(query);
  let pos = 0;
  const peek = () => tokens[pos];
  const take = () => tokens[pos++];

  const parseExpr = (): boolean => {
    let left = parseAnd();
    while (peek()?.kind === "or") {
      take();
      const right = parseAnd();
      left = left || right;
    }
    return left;
  };
  const parseAnd = (): boolean => {
    let left = parseNot();
    let guard = 0;
    while (peek() && peek().kind !== "or" && peek().kind !== "rparen" && guard++ < 64) {
      if (peek().kind === "and") take();
      if (!peek() || peek().kind === "or" || peek().kind === "rparen") break;
      const right = parseNot();
      left = left && right;
    }
    return left;
  };
  const parseNot = (): boolean => {
    if (peek()?.kind === "not") {
      take();
      return !parseNot();
    }
    return parsePrimary();
  };
  const parsePrimary = (): boolean => {
    const token = take();
    if (!token) return true;
    if (token.kind === "lparen") {
      const inner = parseExpr();
      if (peek()?.kind === "rparen") take();
      return inner;
    }
    if (token.kind === "term") return haystack.includes(normalizeText(token.value));
    if (token.kind === "and" || token.kind === "or" || token.kind === "not") {
      return parsePrimary();
    }
    return false;
  };

  try {
    return parseExpr();
  } catch {
    return haystack.includes(normalizeText(query));
  }
}

function foldKey(input: string) {
  return normalizeText(input).replace(/\s+/g, "");
}

function includesNeedle(hay: string, needle: string) {
  if (!needle) return false;
  if (hay.includes(needle)) return true;
  const hayFold = hay.replace(/\s+/g, "");
  const needleFold = needle.replace(/\s+/g, "");
  return needleFold.length >= 2 && hayFold.includes(needleFold);
}

export function mentionSearchText(mention: { title?: string | null; content?: string | null }) {
  return [mention.title, mention.content].filter((part) => Boolean(part && String(part).trim())).join("\n");
}

export function containsAnyWord(text: string, words: string[] | undefined) {
  const hay = normalizeText(text);
  if (!hay) return false;
  return (words ?? []).some((word) => {
    const needle = word.trim();
    if (!needle) return false;
    if (needle === "*" || needle.toLowerCase() === "{arabic}") return isArabicText(text);
    return includesNeedle(hay, normalizeText(needle));
  });
}

export function hasRequiredAny(text: string, words: string[] | undefined) {
  const list = (words ?? []).map((word) => word.trim()).filter(Boolean);
  if (!list.length) return true;
  return containsAnyWord(text, list);
}

export function matchedOnlyTriggerTerms(text: string, rule: KeywordRule) {
  const triggers = (rule.requiredAnyWhen ?? []).map((term) => term.trim()).filter(Boolean);
  if (!triggers.length) return Boolean((rule.requiredAny ?? []).length);
  const triggerKeys = new Set(triggers.flatMap((term) => expandVariants(term).map((item) => normalizeText(item).replace(/\s+/g, ""))));
  const phraseIsTrigger = triggerKeys.has(normalizeText(rule.phrase).replace(/\s+/g, ""));
  const leftoverSynonyms = (rule.synonyms ?? []).filter(
    (term) => !triggerKeys.has(normalizeText(term).replace(/\s+/g, "")),
  );
  const withoutTriggers: KeywordRule = {
    ...rule,
    phrase: phraseIsTrigger ? "__no_trigger_phrase__" : rule.phrase,
    synonyms: leftoverSynonyms,
    requiredAny: [],
    requiredAnyWhen: [],
  };
  if (!phraseIsTrigger && leftoverSynonyms.length === (rule.synonyms ?? []).length) {
    return false;
  }
  return !mentionMatches(text, withoutTriggers);
}

export function keepMention(text: string, rule: KeywordRule, projectExcludes: string[] = []) {
  if (containsAnyWord(text, projectExcludes)) return false;
  if (!mentionMatches(text, rule)) return false;
  if (!rule.requiredAny?.length) return true;
  if (!matchedOnlyTriggerTerms(text, rule)) return true;
  return hasRequiredAny(text, rule.requiredAny);
}

export function mentionMatches(text: string, rule: KeywordRule) {
  const hay = normalizeText(text);
  if (!hay) return false;
  for (const word of rule.excludedWords ?? []) {
    if (word.trim() && includesNeedle(hay, normalizeText(word))) return false;
  }
  for (const word of rule.requiredWords ?? []) {
    if (word.trim() && !includesNeedle(hay, normalizeText(word))) return false;
  }
  if (rule.booleanQuery?.trim()) return evalBoolean(hay, rule.booleanQuery);
  const variants = [rule.phrase, ...(rule.synonyms ?? [])].flatMap((term) =>
    rule.autoVariants === false ? [term, term.replace(/[-–—_]+/g, " "), term.replace(/[-–—_\s]+/g, "")] : expandVariants(term),
  );
  const needles = [...new Set(variants.map(normalizeText).filter(Boolean))];
  if (!needles.length) return true;
  if (rule.matchType === "EXACT") {
    const hayFold = foldKey(hay);
    return needles.some((needle) => {
      const spaced = new RegExp(`(?:^|\\s)${escapeRegExp(needle)}(?:\\s|$)`).test(hay);
      const folded = needle.replace(/\s+/g, "").length >= 2 && hayFold.includes(needle.replace(/\s+/g, ""));
      return spaced || folded;
    });
  }
  return needles.some((needle) => includesNeedle(hay, needle));
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function ruleFromPhrase(phrase: string, extras: Partial<KeywordRule> = {}): KeywordRule {
  return {
    phrase: phrase.trim(),
    matchType: extras.matchType ?? "CONTAINS",
    requiredWords: extras.requiredWords ?? [],
    excludedWords: extras.excludedWords ?? [],
    booleanQuery: extras.booleanQuery ?? null,
    language: extras.language ?? null,
    country: extras.country ?? null,
    synonyms: extras.synonyms ?? [],
    requiredAny: extras.requiredAny ?? [],
    requiredAnyWhen: extras.requiredAnyWhen ?? [],
    autoVariants: extras.autoVariants ?? true,
  };
}

export function csvWords(value: string | null | undefined) {
  return (value ?? "")
    .split(/[,،\n]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}
