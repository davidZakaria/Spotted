import type { Source } from "@prisma/client";
import type { ProjectConfig } from "@/lib/connectors/types";
import { containsAnyWord, csvWords, mentionSearchText, normalizeText } from "./query";

export type BrandAccount = {
  label: string;
  handle?: string;
  url?: string;
};

export type BrandProfile = {
  positiveWords: string[];
  negativeWords: string[];
  officialAccounts: BrandAccount[];
  websites: string[];
  hideOwnPosts: boolean;
  competitors: string[];
  competitorAccounts: BrandAccount[];
  spokespeople: string[];
  products: string[];
  hashtags: string[];
  languages: string[];
  countries: string[];
  sources: Source[];
  excludeWords: string[];
};

export type MentionRole = "own" | "competitor" | "person" | "product";

export type HealthItem = {
  id: string;
  ok: boolean;
  label: string;
  labelAr: string;
};

export function parseAccountLine(raw: string): BrandAccount | null {
  const value = raw.trim();
  if (!value) return null;
  if (/^https?:\/\//i.test(value) || /^[\w.-]+\.[a-z]{2,}(\/|$)/i.test(value)) {
    const url = value.startsWith("http") ? value : `https://${value}`;
    let host = value;
    try {
      host = new URL(url).hostname.replace(/^www\./, "");
    } catch {
      // keep raw
    }
    return { label: host, url, handle: host };
  }
  const handle = value.replace(/^@/, "").replace(/\s+/g, "");
  return { label: value.replace(/^@/, ""), handle };
}

export function parseAccounts(raw: string | string[] | undefined): BrandAccount[] {
  const parts = Array.isArray(raw) ? raw : csvWords(raw);
  const out: BrandAccount[] = [];
  const seen = new Set<string>();
  for (const part of parts) {
    const account = parseAccountLine(part);
    if (!account) continue;
    const key = normalizeText(account.url || account.handle || account.label);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(account);
  }
  return out;
}

export function readBrandProfile(config: ProjectConfig | null | undefined): BrandProfile {
  const c = config ?? {};
  return {
    positiveWords: c.positiveWords ?? [],
    negativeWords: c.negativeWords ?? [],
    officialAccounts: c.officialAccounts ?? [],
    websites: c.websites ?? [],
    hideOwnPosts: Boolean(c.hideOwnPosts),
    competitors: c.competitors ?? [],
    competitorAccounts: c.competitorAccounts ?? [],
    spokespeople: c.spokespeople ?? [],
    products: c.products ?? [],
    hashtags: (c.hashtags ?? []).map((tag) => (tag.startsWith("#") ? tag : `#${tag}`)),
    languages: c.languages ?? [],
    countries: c.countries ?? [],
    sources: c.sources ?? [],
    excludeWords: c.excludeWords ?? [],
  };
}

export function sentimentLexicon(profile: Pick<BrandProfile, "positiveWords" | "negativeWords">) {
  return {
    positive: profile.positiveWords,
    negative: profile.negativeWords,
  };
}

export function profileSerpExtras(profile: BrandProfile, limit = 8) {
  const tags = profile.hashtags.map((tag) => tag.replace(/^#/, "")).filter(Boolean);
  const terms = [...profile.products, ...tags, ...profile.spokespeople, ...profile.competitors]
    .map((term) => term.trim())
    .filter((term) => term.length >= 2);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const term of terms) {
    const key = normalizeText(term).replace(/\s+/g, "");
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(term);
    if (out.length >= limit) break;
  }
  return out;
}

function handleKey(value?: string | null) {
  return normalizeText(value ?? "")
    .replace(/^@/, "")
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "")
    .replace(/\s+/g, "");
}

function hostKey(value?: string | null) {
  if (!value) return "";
  try {
    return new URL(value.startsWith("http") ? value : `https://${value}`).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return handleKey(value);
  }
}

function accountMatches(
  mention: { authorName?: string | null; authorHandle?: string | null; authorUrl?: string | null; url?: string | null },
  account: BrandAccount,
) {
  const needles = [account.handle, account.url, account.label].map(handleKey).filter(Boolean);
  const hay = [mention.authorHandle, mention.authorName, mention.authorUrl, mention.url].map(handleKey).filter(Boolean);
  if (needles.some((needle) => hay.some((part) => part === needle || part.includes(needle) || needle.includes(part)))) {
    return true;
  }
  const hosts = [account.url, account.handle].map(hostKey).filter((host) => host.includes("."));
  const mentionHosts = [mention.authorUrl, mention.url].map(hostKey).filter(Boolean);
  return hosts.some((host) => mentionHosts.some((part) => part === host || part.endsWith(`.${host}`)));
}

export function isOwnPost(
  mention: { authorName?: string | null; authorHandle?: string | null; authorUrl?: string | null; url?: string | null },
  profile: BrandProfile,
) {
  if (profile.officialAccounts.some((account) => accountMatches(mention, account))) return true;
  return profile.websites.some((site) => accountMatches(mention, { label: site, url: site }));
}

export function mentionRoles(
  mention: {
    title?: string | null;
    content?: string | null;
    authorName?: string | null;
    authorHandle?: string | null;
    authorUrl?: string | null;
    url?: string | null;
  },
  profile: BrandProfile,
): MentionRole[] {
  const roles: MentionRole[] = [];
  const text = mentionSearchText(mention);
  if (isOwnPost(mention, profile)) roles.push("own");
  const competitorNames = [
    ...profile.competitors,
    ...profile.competitorAccounts.map((account) => account.label),
    ...profile.competitorAccounts.map((account) => account.handle ?? ""),
  ];
  if (
    profile.competitorAccounts.some((account) => accountMatches(mention, account)) ||
    containsAnyWord(text, competitorNames) ||
    containsAnyWord(mention.authorName ?? "", competitorNames) ||
    containsAnyWord(mention.authorHandle ?? "", competitorNames)
  ) {
    roles.push("competitor");
  }
  if (containsAnyWord(text, profile.spokespeople) || containsAnyWord(mention.authorName ?? "", profile.spokespeople)) {
    roles.push("person");
  }
  const productNeedles = [...profile.products, ...profile.hashtags, ...profile.hashtags.map((tag) => tag.replace(/^#/, ""))];
  if (containsAnyWord(text, productNeedles)) roles.push("product");
  return roles;
}

export function brandHealth(profile: BrandProfile, keywordCount = 0): { score: number; items: HealthItem[] } {
  const items: HealthItem[] = [
    {
      id: "keywords",
      ok: keywordCount >= 1,
      label: "Add at least one word to watch",
      labelAr: "أضف كلمة واحدة على الأقل للمراقبة",
    },
    {
      id: "negative",
      ok: profile.negativeWords.length >= 3,
      label: "Add at least 3 negative words",
      labelAr: "أضف 3 كلمات سلبية على الأقل",
    },
    {
      id: "positive",
      ok: profile.positiveWords.length >= 3,
      label: "Add at least 3 positive words",
      labelAr: "أضف 3 كلمات إيجابية على الأقل",
    },
    {
      id: "official",
      ok: profile.officialAccounts.length + profile.websites.length >= 1,
      label: "Add an official account or website",
      labelAr: "أضف حساباً رسمياً أو موقعاً",
    },
    {
      id: "competitors",
      ok: profile.competitors.length + profile.competitorAccounts.length >= 1,
      label: "Add a competitor to compare",
      labelAr: "أضف منافساً للمقارنة",
    },
    {
      id: "people",
      ok: profile.spokespeople.length >= 1,
      label: "Add a spokesperson or executive",
      labelAr: "أضف متحدثاً أو مديراً",
    },
    {
      id: "products",
      ok: profile.products.length >= 1,
      label: "Add a product or project name",
      labelAr: "أضف اسم منتج أو مشروع",
    },
    {
      id: "hashtags",
      ok: profile.hashtags.length >= 1,
      label: "Add a hashtag you use",
      labelAr: "أضف وسم تستخدمه",
    },
    {
      id: "languages",
      ok: profile.languages.length >= 1,
      label: "Choose the languages you care about",
      labelAr: "اختر اللغات التي تهمك",
    },
    {
      id: "sources",
      ok: profile.sources.length >= 1,
      label: "Turn on the sites to watch",
      labelAr: "فعّل المواقع للمراقبة",
    },
    {
      id: "excludes",
      ok: profile.excludeWords.length >= 1,
      label: "Add words to ignore (cuts noise)",
      labelAr: "أضف كلمات للتجاهل (تقلل الضوضاء)",
    },
  ];
  const ok = items.filter((item) => item.ok).length;
  return { score: Math.round((ok / items.length) * 100), items };
}

export function roleLabel(role: MentionRole, locale: string) {
  if (locale === "ar") {
    if (role === "own") return "منشورنا";
    if (role === "competitor") return "منافس";
    if (role === "person") return "شخص";
    return "منتج";
  }
  if (role === "own") return "Own post";
  if (role === "competitor") return "Competitor";
  if (role === "person") return "Person";
  return "Product";
}
