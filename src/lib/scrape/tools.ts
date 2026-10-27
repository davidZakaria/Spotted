import type { Source } from "@prisma/client";
import type { RawMention } from "@/lib/connectors/types";
import { parsePublishedAt } from "@/lib/listen/dates";

export type ScrapeField = {
  name: string;
  label: string;
  labelAr: string;
  hint: string;
  hintAr: string;
  placeholder?: string;
  type?: "text" | "textarea" | "number";
  required?: boolean;
};

export type ScrapeTool = {
  id: string;
  name: string;
  nameAr: string;
  helper: string;
  helperAr: string;
  actorId: string;
  source: Source;
  estimateUsd: number;
  fields: ScrapeField[];
  advanced?: boolean;
};

export const SCRAPE_TOOLS: ScrapeTool[] = [
  {
    id: "website",
    name: "Any website",
    nameAr: "أي موقع",
    helper: "Paste page links. We copy the public text — useful for blogs, news, and landing pages.",
    helperAr: "الصق روابط الصفحات. ننسخ النص العام — مفيد للمدونات والأخبار وصفحات الهبوط.",
    actorId: "apify/website-content-crawler",
    source: "WEB_SEARCH",
    estimateUsd: 0.4,
    fields: [
      {
        name: "urls",
        label: "Page links",
        labelAr: "روابط الصفحات",
        hint: "One link per line.",
        hintAr: "رابط في كل سطر.",
        type: "textarea",
        required: true,
        placeholder: "https://example.com/about",
      },
      {
        name: "maxPages",
        label: "How many pages at most?",
        labelAr: "كم صفحة كحد أقصى؟",
        hint: "Keep this small. Each page costs a little.",
        hintAr: "أبقِ الرقم صغيراً. كل صفحة لها تكلفة.",
        type: "number",
        placeholder: "10",
      },
    ],
  },
  {
    id: "google",
    name: "Google search results",
    nameAr: "نتائج بحث جوجل",
    helper: "Type a search the way you would in Google. We save the public results.",
    helperAr: "اكتب بحثاً كما تكتبه في جوجل. نحفظ النتائج العامة.",
    actorId: "apify/google-search-scraper",
    source: "WEB_SEARCH",
    estimateUsd: 0.25,
    fields: [
      {
        name: "queries",
        label: "Searches",
        labelAr: "عمليات البحث",
        hint: "One search per line.",
        hintAr: "بحث في كل سطر.",
        type: "textarea",
        required: true,
        placeholder: "New Jersey Developments Cairo",
      },
      {
        name: "country",
        label: "Country code",
        labelAr: "رمز الدولة",
        hint: "eg, us, ae…",
        hintAr: "eg أو us أو ae…",
        placeholder: "eg",
      },
    ],
  },
  {
    id: "facebook-posts",
    name: "Facebook Page posts",
    nameAr: "منشورات صفحة فيسبوك",
    helper: "Public Page posts only. Paste the Page link — we do not store any login.",
    helperAr: "منشورات الصفحات العامة فقط. الصق رابط الصفحة — لا نحفظ أي تسجيل دخول.",
    actorId: "apify/facebook-posts-scraper",
    source: "FACEBOOK",
    estimateUsd: 0.8,
    fields: [
      {
        name: "urls",
        label: "Facebook Page links",
        labelAr: "روابط صفحات فيسبوك",
        hint: "One public Page per line.",
        hintAr: "صفحة عامة في كل سطر.",
        type: "textarea",
        required: true,
        placeholder: "https://www.facebook.com/yourbrand",
      },
    ],
  },
  {
    id: "facebook-comments",
    name: "Facebook comments",
    nameAr: "تعليقات فيسبوك",
    helper: "Public comments on a post or Page. Follow Facebook’s rules.",
    helperAr: "تعليقات عامة على منشور أو صفحة. التزم بقواعد فيسبوك.",
    actorId: "apify/facebook-comments-scraper",
    source: "FACEBOOK",
    estimateUsd: 0.8,
    fields: [
      {
        name: "urls",
        label: "Post or Page links",
        labelAr: "روابط المنشور أو الصفحة",
        hint: "One public link per line.",
        hintAr: "رابط عام في كل سطر.",
        type: "textarea",
        required: true,
      },
    ],
  },
  {
    id: "facebook-groups",
    name: "Facebook groups (public)",
    nameAr: "مجموعات فيسبوك (عامة)",
    helper: "Public groups only. Private groups need a login — we will not ask for one.",
    helperAr: "المجموعات العامة فقط. الخاصة تحتاج حساباً — لن نطلبه.",
    actorId: "apify/facebook-groups-scraper",
    source: "FACEBOOK",
    estimateUsd: 0.8,
    fields: [
      {
        name: "urls",
        label: "Public group links",
        labelAr: "روابط المجموعات العامة",
        hint: "Must be a public group.",
        hintAr: "يجب أن تكون المجموعة عامة.",
        type: "textarea",
        required: true,
      },
    ],
  },
  {
    id: "instagram",
    name: "Instagram profiles, posts, hashtags",
    nameAr: "إنستغرام: حسابات ومنشورات ووسوم",
    helper: "Public profiles, posts, or hashtags. No Instagram password is stored.",
    helperAr: "حسابات أو منشورات أو وسوم عامة. لا نحفظ كلمة مرور إنستغرام.",
    actorId: "apify/instagram-scraper",
    source: "INSTAGRAM",
    estimateUsd: 0.8,
    fields: [
      {
        name: "urls",
        label: "Profile or post links",
        labelAr: "روابط الحساب أو المنشور",
        hint: "Optional if you add hashtags below.",
        hintAr: "اختياري إن أضفت وسوماً بالأسفل.",
        type: "textarea",
        placeholder: "https://www.instagram.com/yourbrand/",
      },
      {
        name: "hashtags",
        label: "Hashtags",
        labelAr: "الوسوم",
        hint: "Without or with #. One per line.",
        hintAr: "مع # أو بدونه. واحد في كل سطر.",
        type: "textarea",
        placeholder: "njd\ngenesis",
      },
    ],
  },
  {
    id: "linkedin",
    name: "LinkedIn company posts",
    nameAr: "منشورات شركة على لينكدإن",
    helper: "Public company pages, no cookie or login. Paste the company URL.",
    helperAr: "صفحات الشركات العامة بلا كوكي أو دخول. الصق رابط الشركة.",
    actorId: "harvestapi/linkedin-company-posts",
    source: "LINKEDIN",
    estimateUsd: 0.6,
    fields: [
      {
        name: "urls",
        label: "LinkedIn company links",
        labelAr: "روابط شركة لينكدإن",
        hint: "Example: linkedin.com/company/yourbrand",
        hintAr: "مثال: linkedin.com/company/yourbrand",
        type: "textarea",
        required: true,
      },
    ],
  },
  {
    id: "tiktok",
    name: "TikTok",
    nameAr: "تيك توك",
    helper: "Public profiles or hashtags. We only read what anyone can see.",
    helperAr: "حسابات أو وسوم عامة. نقرأ ما يراه الجميع فقط.",
    actorId: "clockworks/tiktok-scraper",
    source: "TIKTOK",
    estimateUsd: 0.6,
    fields: [
      {
        name: "profiles",
        label: "Usernames",
        labelAr: "أسماء الحسابات",
        hint: "Without @. One per line.",
        hintAr: "بدون @. واحد في كل سطر.",
        type: "textarea",
      },
      {
        name: "hashtags",
        label: "Hashtags",
        labelAr: "الوسوم",
        hint: "One per line.",
        hintAr: "واحد في كل سطر.",
        type: "textarea",
      },
    ],
  },
  {
    id: "youtube",
    name: "YouTube comments",
    nameAr: "تعليقات يوتيوب",
    helper: "Public comments on a video. Paste the watch link.",
    helperAr: "تعليقات عامة على فيديو. الصق رابط المشاهدة.",
    actorId: "streamers/youtube-comments-scraper",
    source: "YOUTUBE",
    estimateUsd: 0.4,
    fields: [
      {
        name: "urls",
        label: "YouTube video links",
        labelAr: "روابط فيديوهات يوتيوب",
        hint: "One video per line.",
        hintAr: "فيديو في كل سطر.",
        type: "textarea",
        required: true,
      },
    ],
  },
  {
    id: "x",
    name: "X (Twitter)",
    nameAr: "إكس (تويتر)",
    helper: "Public posts matching a search. This tool is often the most expensive.",
    helperAr: "منشورات عامة مطابقة لبحث. غالباً الأغلى بين الأدوات.",
    actorId: "apidojo/tweet-scraper",
    source: "X",
    estimateUsd: 1.2,
    fields: [
      {
        name: "queries",
        label: "Searches",
        labelAr: "عمليات البحث",
        hint: "Same as the X search box.",
        hintAr: "كما في صندوق بحث إكس.",
        type: "textarea",
        required: true,
        placeholder: "\"New Jersey Developments\"",
      },
    ],
  },
  {
    id: "maps",
    name: "Google Maps places and reviews",
    nameAr: "أماكن ومراجعات خرائط جوجل",
    helper: "Build a lead list of places, or pull public reviews. Search like you would in Maps.",
    helperAr: "ابنِ قائمة أماكن أو اسحب المراجعات العامة. ابحث كما في الخرائط.",
    actorId: "compass/crawler-google-places",
    source: "GOOGLE_MAPS",
    estimateUsd: 0.5,
    fields: [
      {
        name: "queries",
        label: "Maps searches",
        labelAr: "بحث الخرائط",
        hint: "Example: real estate office Cairo",
        hintAr: "مثال: مكتب عقارات القاهرة",
        type: "textarea",
        required: true,
      },
      {
        name: "maxItems",
        label: "How many places?",
        labelAr: "كم مكاناً؟",
        hint: "Start with 20.",
        hintAr: "ابدأ بـ 20.",
        type: "number",
        placeholder: "20",
      },
    ],
  },
  {
    id: "ads",
    name: "Facebook Ads Library",
    nameAr: "مكتبة إعلانات فيسبوك",
    helper: "Public ads from Meta’s Ads Library. Search a brand or Page.",
    helperAr: "إعلانات عامة من مكتبة ميتا. ابحث عن علامة أو صفحة.",
    actorId: "curious_coder/facebook-ads-library",
    source: "FACEBOOK",
    estimateUsd: 0.7,
    fields: [
      {
        name: "queries",
        label: "Brand or Page name",
        labelAr: "اسم العلامة أو الصفحة",
        hint: "One search per line.",
        hintAr: "بحث في كل سطر.",
        type: "textarea",
        required: true,
      },
      {
        name: "country",
        label: "Country code",
        labelAr: "رمز الدولة",
        hint: "EG, US, AE…",
        hintAr: "EG أو US أو AE…",
        placeholder: "EG",
      },
    ],
  },
  {
    id: "advanced",
    name: "Advanced: any Apify actor",
    nameAr: "متقدم: أي أداة Apify",
    helper: "Paste an actor id (owner/name) and the JSON it expects. For people who already use Apify.",
    helperAr: "الصق معرّف الأداة (صاحب/اسم) وجيسون الإدخال. لمن يستخدم Apify مسبقاً.",
    actorId: "",
    source: "WEB_SEARCH",
    estimateUsd: 0.5,
    advanced: true,
    fields: [
      {
        name: "actorId",
        label: "Actor id",
        labelAr: "معرّف الأداة",
        hint: "Example: apify/website-content-crawler",
        hintAr: "مثال: apify/website-content-crawler",
        required: true,
        placeholder: "apify/google-search-scraper",
      },
      {
        name: "json",
        label: "JSON input",
        labelAr: "إدخال JSON",
        hint: "Must be valid JSON.",
        hintAr: "يجب أن يكون JSON صالحاً.",
        type: "textarea",
        required: true,
        placeholder: "{ \"queries\": \"example\" }",
      },
    ],
  },
];

export function scrapeTool(id: string) {
  return SCRAPE_TOOLS.find((tool) => tool.id === id);
}

function lines(value: FormData | Record<string, string>, name: string) {
  const raw = value instanceof FormData ? String(value.get(name) ?? "") : String(value[name] ?? "");
  return raw
    .split(/\r?\n|,/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function num(value: FormData | Record<string, string>, name: string, fallback: number) {
  const raw = value instanceof FormData ? String(value.get(name) ?? "") : String(value[name] ?? "");
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

export function buildScrapeInput(toolId: string, value: FormData | Record<string, string>) {
  const tool = scrapeTool(toolId);
  if (!tool) throw new Error("Unknown scraper tool");
  if (tool.id === "advanced") {
    const actorId = (value instanceof FormData ? String(value.get("actorId") ?? "") : value.actorId ?? "").trim();
    if (!actorId) throw new Error("Paste an actor id");
    const raw = value instanceof FormData ? String(value.get("json") ?? "") : value.json ?? "";
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("bad");
      return { actorId, input: parsed as Record<string, unknown> };
    } catch {
      throw new Error("The JSON input is not valid. Check the commas and quotes.");
    }
  }
  const urls = lines(value, "urls");
  const queries = lines(value, "queries");
  const hashtags = lines(value, "hashtags").map((tag) => tag.replace(/^#/, ""));
  const profiles = lines(value, "profiles").map((name) => name.replace(/^@/, ""));
  const country = (value instanceof FormData ? String(value.get("country") ?? "") : value.country ?? "").trim();
  let input: Record<string, unknown> = {};
  switch (tool.id) {
    case "website":
      if (!urls.length) throw new Error("Paste at least one page link");
      input = {
        startUrls: urls.map((url) => ({ url })),
        maxCrawlPages: Math.min(num(value, "maxPages", 10), 40),
      };
      break;
    case "google":
      if (!queries.length) throw new Error("Type at least one Google search");
      input = { queries, countryCode: (country || "eg").toLowerCase(), maxPagesPerQuery: 1, resultsPerPage: 10 };
      break;
    case "facebook-posts":
    case "facebook-comments":
    case "facebook-groups":
      if (!urls.length) throw new Error("Paste at least one Facebook link");
      input = { startUrls: urls.map((url) => ({ url })), resultsLimit: 40 };
      break;
    case "instagram":
      if (!urls.length && !hashtags.length) throw new Error("Paste a profile link or a hashtag");
      input = {
        directUrls: urls,
        searchType: hashtags.length ? "hashtag" : "user",
        searchLimit: 20,
        resultsType: "posts",
        resultsLimit: 30,
        ...(hashtags.length ? { search: hashtags.join(",") } : {}),
      };
      break;
    case "linkedin":
      if (!urls.length) throw new Error("Paste a LinkedIn company link");
      input = { urls, limit: 30 };
      break;
    case "tiktok":
      if (!profiles.length && !hashtags.length) throw new Error("Add a username or a hashtag");
      input = { profiles, hashtags, resultsPerPage: 20 };
      break;
    case "youtube":
      if (!urls.length) throw new Error("Paste a YouTube video link");
      input = { startUrls: urls.map((url) => ({ url })), maxComments: 80 };
      break;
    case "x":
      if (!queries.length) throw new Error("Type at least one X search");
      input = { searchTerms: queries, maxItems: 40 };
      break;
    case "maps":
      if (!queries.length) throw new Error("Type a Maps search");
      input = { searchStringsArray: queries, maxCrawledPlacesPerSearch: Math.min(num(value, "maxItems", 20), 50), language: "en" };
      break;
    case "ads":
      if (!queries.length) throw new Error("Type a brand or Page name");
      input = { urls: queries, count: 30, country: (country || "EG").toUpperCase() };
      break;
    default:
      throw new Error("Unknown scraper tool");
  }
  return { actorId: tool.actorId, input };
}

function pickString(item: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = item[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (value && typeof value === "object" && "name" in (value as object)) {
      const name = (value as { name?: unknown }).name;
      if (typeof name === "string" && name.trim()) return name.trim();
    }
  }
  return "";
}

export function scrapeItemToMention(tool: ScrapeTool, item: Record<string, unknown>, index: number): RawMention | null {
  const url = pickString(item, ["url", "link", "postUrl", "inputUrl", "googleUrl", "reviewUrl", "adArchiveUrl", "website"]);
  const title = pickString(item, ["title", "pageName", "name", "fullName", "text", "caption"]);
  const content =
    pickString(item, [
      "text",
      "caption",
      "comment",
      "description",
      "snippet",
      "markdown",
      "textSnippet",
      "reviewText",
      "body",
      "headline",
    ]) || title;
  if (!url && !content) return null;
  const author = pickString(item, ["authorName", "ownerUsername", "user", "username", "pageName", "author", "displayedName"]);
  const date = pickString(item, ["date", "timestamp", "publishedAt", "time", "createdAt"]);
  return {
    source: tool.source,
    externalId: String(item.id ?? item.postId ?? item.reviewId ?? url ?? `${tool.id}:${index}`).slice(0, 190),
    url: url || "https://example.invalid",
    title: title || tool.name,
    content: content.slice(0, 8000),
    authorName: author || undefined,
    authorHandle: pickString(item, ["username", "ownerUsername", "user"]) || undefined,
    publishedAt: parsePublishedAt(date || undefined),
    kind: "scrape",
    raw: item,
  };
}

export function scrapeColumns(items: Record<string, unknown>[]) {
  const preferred = [
    "title",
    "text",
    "url",
    "link",
    "name",
    "caption",
    "authorName",
    "username",
    "date",
    "rating",
    "address",
    "phone",
    "website",
    "snippet",
  ];
  const keys = new Set<string>();
  for (const item of items.slice(0, 20)) {
    Object.keys(item).forEach((key) => {
      if (typeof item[key] === "string" || typeof item[key] === "number") keys.add(key);
    });
  }
  const ordered = preferred.filter((key) => keys.has(key));
  const rest = [...keys].filter((key) => !ordered.includes(key)).slice(0, 8);
  return ordered.length ? [...ordered, ...rest].slice(0, 8) : ["title", "url"];
}

export function itemsToCsv(items: Record<string, unknown>[]) {
  const columns = scrapeColumns(items);
  const escape = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const lines = [columns.join(","), ...items.map((item) => columns.map((column) => escape(item[column])).join(","))];
  return `\uFEFF${lines.join("\n")}`;
}
