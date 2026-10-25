import type { Source } from "@prisma/client";

export type AccountLite = {
  platform: Source;
  displayName: string;
  isMock: boolean;
};

export type ConnectionKind = "working" | "ready" | "connected" | "needs_setup";

export type ConnectionView = {
  kind: ConnectionKind;
  badge: string;
  badgeAr: string;
  tone: "good" | "warn" | "accent" | "muted";
  showConnect: boolean;
};

export function connectedNames(accounts: AccountLite[], platform: Source) {
  return accounts.filter((account) => account.platform === platform && !account.isMock).map((account) => account.displayName);
}

export function describeConnection(input: {
  platform: Source;
  keyless: boolean;
  hasAppKeys: boolean;
  accounts: AccountLite[];
  youtubeSearchWorks?: boolean;
  youtubeOAuthReady?: boolean;
  locale?: string;
}): ConnectionView {
  const names = connectedNames(input.accounts, input.platform);
  if (names.length) {
    const first = names[0];
    const extra = names.length > 1 ? ` +${names.length - 1}` : "";
    return {
      kind: "connected",
      badge: `Connected as ${first}${extra}`,
      badgeAr: `متصل باسم ${first}${extra}`,
      tone: "good",
      showConnect: true,
    };
  }

  if (input.platform === "YOUTUBE") {
    if (input.youtubeSearchWorks && !input.youtubeOAuthReady) {
      return {
        kind: "working",
        badge: "Working",
        badgeAr: "يعمل",
        tone: "good",
        showConnect: false,
      };
    }
    if (input.youtubeOAuthReady) {
      return {
        kind: "ready",
        badge: "Ready to connect",
        badgeAr: "جاهز للربط",
        tone: "accent",
        showConnect: true,
      };
    }
    if (input.youtubeSearchWorks) {
      return {
        kind: "working",
        badge: "Working",
        badgeAr: "يعمل",
        tone: "good",
        showConnect: false,
      };
    }
    return {
      kind: "needs_setup",
      badge: "Needs setup",
      badgeAr: "يحتاج إعداداً",
      tone: "warn",
      showConnect: false,
    };
  }

  const oauthPath = oauthPathFor(input.platform);

  if (input.keyless) {
    return {
      kind: "working",
      badge: "Working",
      badgeAr: "يعمل",
      tone: "good",
      showConnect: false,
    };
  }

  if (input.hasAppKeys) {
    if (!oauthPath) {
      return {
        kind: "working",
        badge: "Working",
        badgeAr: "يعمل",
        tone: "good",
        showConnect: false,
      };
    }
    return {
      kind: "ready",
      badge: "Ready to connect",
      badgeAr: "جاهز للربط",
      tone: "accent",
      showConnect: true,
    };
  }

  return {
    kind: "needs_setup",
    badge: "Needs setup",
    badgeAr: "يحتاج إعداداً",
    tone: "warn",
    showConnect: Boolean(oauthPath),
  };
}

export function hasMetaAppKeys(env: Record<string, string | undefined> = process.env) {
  return Boolean(env.META_APP_ID?.trim() && env.META_APP_SECRET?.trim());
}

export function hasGoogleOAuth(env: Record<string, string | undefined> = process.env) {
  const id = env.GOOGLE_OAUTH_CLIENT_ID?.trim() || env.GOOGLE_GBP_CLIENT_ID?.trim();
  const secret = env.GOOGLE_OAUTH_CLIENT_SECRET?.trim() || env.GOOGLE_GBP_CLIENT_SECRET?.trim();
  return Boolean(id && secret);
}

export function hasYoutubeApiKey(env: Record<string, string | undefined> = process.env) {
  return Boolean(env.YOUTUBE_API_KEY?.trim());
}

export function oauthPathFor(platform: Source): string | undefined {
  if (platform === "FACEBOOK" || platform === "INSTAGRAM") return "/api/oauth/meta";
  if (platform === "THREADS") return "/api/oauth/threads";
  if (platform === "X") return "/api/oauth/x";
  if (platform === "LINKEDIN") return "/api/oauth/linkedin";
  if (platform === "YOUTUBE" || platform === "GOOGLE_BUSINESS") return "/api/oauth/google";
  return undefined;
}

function pair(e: Record<string, string | undefined>, a: string, b: string) {
  return Boolean(e[a]?.trim() && e[b]?.trim());
}

export function hasThreadsKeys(e: Record<string, string | undefined> = process.env) {
  return pair(e, "THREADS_APP_ID", "THREADS_APP_SECRET");
}

export function hasRedditApp(e: Record<string, string | undefined> = process.env) {
  return pair(e, "REDDIT_CLIENT_ID", "REDDIT_CLIENT_SECRET");
}

export function hasBlueskySession(e: Record<string, string | undefined> = process.env) {
  return pair(e, "BLUESKY_HANDLE", "BLUESKY_APP_PASSWORD");
}

export function hasAppKeys(platform: Source, e: Record<string, string | undefined> = process.env): boolean {
  switch (platform) {
    case "FACEBOOK":
    case "INSTAGRAM":
      return hasMetaAppKeys(e);
    case "THREADS":
      return hasThreadsKeys(e);
    case "X":
      return pair(e, "TWITTER_CLIENT_ID", "TWITTER_CLIENT_SECRET");
    case "LINKEDIN":
      return pair(e, "LINKEDIN_CLIENT_ID", "LINKEDIN_CLIENT_SECRET");
    case "YOUTUBE":
      return hasYoutubeApiKey(e) || hasGoogleOAuth(e);
    case "GOOGLE_BUSINESS":
      return hasGoogleOAuth(e);
    case "WEB_SEARCH":
    case "QUORA":
      return Boolean(e.BRAVE_SEARCH_API_KEY?.trim() || e.SERPAPI_API_KEY?.trim());
    case "TIKTOK":
      return pair(e, "TIKTOK_CLIENT_KEY", "TIKTOK_CLIENT_SECRET");
    case "PINTEREST":
      return pair(e, "PINTEREST_APP_ID", "PINTEREST_APP_SECRET");
    case "DISCORD":
      return Boolean(e.DISCORD_BOT_TOKEN?.trim() || pair(e, "DISCORD_CLIENT_ID", "DISCORD_CLIENT_SECRET"));
    case "TWITCH":
      return pair(e, "TWITCH_CLIENT_ID", "TWITCH_CLIENT_SECRET");
    case "TRUSTPILOT":
      return Boolean(e.TRUSTPILOT_API_KEY?.trim());
    case "G2":
      return Boolean(e.G2_API_TOKEN?.trim());
    case "PLAY_STORE":
      return Boolean(e.GOOGLE_PLAY_JSON?.trim());
    case "SNAPCHAT":
      return pair(e, "SNAPCHAT_CLIENT_ID", "SNAPCHAT_CLIENT_SECRET");
    default:
      return false;
  }
}
