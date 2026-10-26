import { keepMention, mentionMatches, mentionSearchText, ruleFromPhrase, type KeywordRule } from "./query";

export const NJD_PROJECT_IDS = ["cmvnxiiab0001ph6ufsm2ela1", "njdbadpr983724993"] as const;
export const NJD_MAPS_PROJECT_ID = "njdbadpr983724993";

export const NJD_EXCLUDE_WORDS = [
  "Trenton",
  "Newark",
  "Jersey City",
  "Hoboken",
  "Murphy",
  "NJ.com",
  "Garden State",
  "township",
];

export const NJD_CONTEXT_WORDS = [
  "Egypt",
  "Cairo",
  "Sokhna",
  "North Coast",
  "New Capital",
  "Genesis",
  "Jura",
  "Jamila",
  "مصر",
  "{arabic}",
];

export const NJD_CONTEXT_WHEN = [
  "New Jersey Development",
  "New Jersey Developments",
  "NJ Development",
  "NJ Developments",
];

export function njdEnglishRule(): KeywordRule {
  return ruleFromPhrase("New Jersey Development", {
    synonyms: [...NJD_CONTEXT_WHEN],
    requiredAny: [...NJD_CONTEXT_WORDS],
    requiredAnyWhen: [...NJD_CONTEXT_WHEN],
  });
}

export function mentionFailsNewRules(input: {
  source: string;
  title?: string | null;
  content: string;
  keywords: KeywordRule[];
  excludeWords: string[];
}) {
  const text = mentionSearchText(input);
  if (keepMention(text, ruleFromPhrase(""), input.excludeWords) === false) return true;
  if (input.source === "GOOGLE_MAPS") return false;
  const matching = input.keywords.filter((rule) =>
    mentionMatches(text, { ...rule, requiredAny: [], requiredAnyWhen: [] }),
  );
  if (!matching.length) {
    const english = njdEnglishRule();
    return mentionMatches(text, { ...english, requiredAny: [], requiredAnyWhen: [] }) && !keepMention(text, english);
  }
  return matching.every((rule) => !keepMention(text, rule, input.excludeWords));
}
