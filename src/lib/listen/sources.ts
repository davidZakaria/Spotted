import type { Source } from "@prisma/client";
import { env } from "@/lib/config";
import { hasRedditApp, hasYoutubeApiKey } from "@/lib/platform-status";
import { REDDIT_VIA_GOOGLE_NOTE, REDDIT_VIA_GOOGLE_NOTE_AR } from "@/lib/connectors/reddit";

export type LiveSourceStatus = {
  id: Source;
  name: string;
  nameAr: string;
  ready: boolean;
  note?: string;
  noteAr?: string;
};

export function liveSourcePlan(input: {
  connected: Source[];
  telegramChannels?: string[];
  googleAlertFeeds?: string[];
  env?: Record<string, string | undefined>;
  serpRemaining?: number;
  serpLimit?: number;
}): LiveSourceStatus[] {
  const e = input.env ?? process.env;
  const connected = new Set(input.connected);
  const youtube = hasYoutubeApiKey(e);
  const serp = Boolean(e.SERPAPI_API_KEY?.trim());
  const brave = Boolean(e.BRAVE_SEARCH_API_KEY?.trim());
  const web = serp || brave;
  const x = Boolean(e.TWITTER_BEARER_TOKEN?.trim());
  const serpLeft = input.serpRemaining;
  const serpNote =
    serp && serpLeft === 0
      ? `SerpAPI monthly limit reached${input.serpLimit ? ` (${input.serpLimit})` : ""}. Web search skipped until next month.`
      : serp && serpLeft != null
        ? `${serpLeft} SerpAPI searches left this month`
        : undefined;
  const serpNoteAr =
    serp && serpLeft === 0
      ? "انتهى حد SerpAPI هذا الشهر."
      : serp && serpLeft != null
        ? `تبقّى ${serpLeft} بحثاً من SerpAPI هذا الشهر`
        : undefined;
  const rows: LiveSourceStatus[] = [
    {
      id: "REDDIT",
      name: "Reddit",
      nameAr: "ريديت",
      ready: hasRedditApp(e) || (serp && serpLeft !== 0),
      note: hasRedditApp(e)
        ? undefined
        : serp && serpLeft === 0
          ? "SerpAPI monthly limit reached. Reddit via Google is paused until next month."
          : REDDIT_VIA_GOOGLE_NOTE,
      noteAr: hasRedditApp(e)
        ? undefined
        : serp && serpLeft === 0
          ? "انتهى حد SerpAPI. بحث ريديت عبر جوجل متوقف حتى الشهر القادم."
          : REDDIT_VIA_GOOGLE_NOTE_AR,
    },
    { id: "HACKER_NEWS", name: "Hacker News", nameAr: "هاكر نيوز", ready: true },
    { id: "GOOGLE_NEWS", name: "Google News", nameAr: "أخبار جوجل", ready: true },
    { id: "RSS", name: "News sites & blogs", nameAr: "مواقع الأخبار", ready: true },
    { id: "BLUESKY", name: "Bluesky", nameAr: "بلوسكاي", ready: true },
    { id: "MASTODON", name: "Mastodon", nameAr: "ماستدون", ready: true },
    { id: "PODCASTS", name: "Podcasts", nameAr: "البودكاست", ready: true },
    { id: "APP_STORE", name: "App Store", nameAr: "متجر آبل", ready: true },
    {
      id: "YOUTUBE",
      name: "YouTube",
      nameAr: "يوتيوب",
      ready: youtube,
      note: youtube ? undefined : "Add YOUTUBE_API_KEY to include",
      noteAr: youtube ? undefined : "أضف YOUTUBE_API_KEY للتضمين",
    },
    {
      id: "GOOGLE_ALERTS",
      name: "Google Alerts",
      nameAr: "تنبيهات جوجل",
      ready: Boolean(input.googleAlertFeeds?.length),
      note: input.googleAlertFeeds?.length ? undefined : "Paste a Google Alerts RSS link in brand settings",
      noteAr: input.googleAlertFeeds?.length ? undefined : "الصق رابط تنبيه جوجل في إعدادات العلامة",
    },
    {
      id: "TELEGRAM",
      name: "Telegram",
      nameAr: "تيليجرام",
      ready: Boolean(input.telegramChannels?.length),
      note: input.telegramChannels?.length ? undefined : "Add a public channel name in brand settings",
      noteAr: input.telegramChannels?.length ? undefined : "أضف اسم قناة عامة في إعدادات العلامة",
    },
    {
      id: "FACEBOOK",
      name: "Facebook Pages",
      nameAr: "صفحات فيسبوك",
      ready: connected.has("FACEBOOK"),
      note: connected.has("FACEBOOK") ? undefined : "Connect a Facebook Page first",
      noteAr: connected.has("FACEBOOK") ? undefined : "اربط صفحة فيسبوك أولاً",
    },
    {
      id: "WEB_SEARCH",
      name: "Web & blogs",
      nameAr: "الويب والمدونات",
      ready: web && !(serp && !brave && serpLeft === 0),
      note: web
        ? serpNote
        : "Add key to include (SERPAPI_API_KEY or BRAVE_SEARCH_API_KEY)",
      noteAr: web ? serpNoteAr : "أضف مفتاح بحث الويب للتضمين",
    },
    {
      id: "QUORA",
      name: "Quora & forums",
      nameAr: "كورا والمنتديات",
      ready: brave,
      note: brave ? undefined : "Add key to include (BRAVE_SEARCH_API_KEY). SerpAPI is reserved for Google web and News.",
      noteAr: brave ? undefined : "أضف BRAVE_SEARCH_API_KEY. SerpAPI reserved لجوجل والأخبار.",
    },
    {
      id: "X",
      name: "X (Twitter)",
      nameAr: "إكس",
      ready: x,
      note: x ? undefined : "Add key to include (TWITTER_BEARER_TOKEN)",
      noteAr: x ? undefined : "أضف TWITTER_BEARER_TOKEN للتضمين",
    },
    {
      id: "INSTAGRAM",
      name: "Instagram hashtags",
      nameAr: "هاشتاج إنستغرام",
      ready: connected.has("INSTAGRAM"),
      note: connected.has("INSTAGRAM") ? undefined : "Add key / connect Instagram to include",
      noteAr: connected.has("INSTAGRAM") ? undefined : "اربط إنستغرام أو أضف المفاتيح",
    },
    {
      id: "TIKTOK",
      name: "TikTok",
      nameAr: "تيك توك",
      ready: false,
      note: "Add key to include — TikTok only shares your own account",
      noteAr: "أضف المفاتيح — تيك توك يشارك حسابك فقط",
    },
  ];
  void env;
  return rows;
}

export function readyLiveSources(plan: LiveSourceStatus[]) {
  return plan.filter((row) => row.ready).map((row) => row.id);
}
