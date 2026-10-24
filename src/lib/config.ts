export function env(name: string, fallback = "") {
  return process.env[name]?.trim() || fallback;
}

export function envFlag(name: string, fallback = false) {
  const raw = process.env[name];
  if (raw == null || raw === "") return fallback;
  return ["1", "true", "yes", "on"].includes(raw.toLowerCase());
}

export const appConfig = {
  url: env("APP_URL", "http://127.0.0.1:4721"),
  authSecret: env("AUTH_SECRET", "aether-dev-secret-change-in-production-please"),
  redisUrl: env("REDIS_URL", "redis://127.0.0.1:6379"),
  webSearchProvider: (env("WEB_SEARCH_PROVIDER", "brave") === "serpapi"
    ? "serpapi"
    : "brave") as "brave" | "serpapi",
  graphVersion: env("META_GRAPH_VERSION", "v21.0"),
  mastodonInstance: env("MASTODON_INSTANCE", "https://mastodon.social"),
  youtubeKey: env("YOUTUBE_API_KEY"),
  braveKey: env("BRAVE_SEARCH_API_KEY"),
  serpApiKey: env("SERPAPI_API_KEY"),
  openaiKey: env("OPENAI_API_KEY"),
  openaiModel: env("OPENAI_MODEL", "gpt-4o-mini"),
  twitterBearer: env("TWITTER_BEARER_TOKEN"),
  metaAppId: env("META_APP_ID"),
  metaAppSecret: env("META_APP_SECRET"),
  metaPageToken: env("META_PAGE_ACCESS_TOKEN"),
  slackWebhook: env("SLACK_WEBHOOK_URL"),
};

export function oauthRedirect(provider: string) {
  return `${appConfig.url}/api/oauth/${provider}/callback`;
}
