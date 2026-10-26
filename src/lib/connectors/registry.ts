import type { Source } from "@prisma/client";
import { SOURCE_CATALOG } from "./catalog";
import type { Connector } from "./types";
import { redditConnector } from "./reddit";
import { hnConnector } from "./hackernews";
import { rssConnector } from "./rss";
import { googleAlertsConnector, googleBusinessConnector, googleNewsConnector, googleTrendsConnector } from "./google";
import { googleMapsConnector } from "./maps";
import { quoraConnector, webSearchConnector } from "./websearch";
import { blueskyConnector } from "./bluesky";
import { mastodonConnector } from "./mastodon";
import { youtubeConnector } from "./youtube";
import { xConnector } from "./x";
import { facebookConnector, instagramConnector, threadsConnector } from "./meta";
import { linkedinConnector } from "./linkedin";
import { tiktokConnector } from "./tiktok";
import { discordConnector, pinterestConnector, snapchatConnector, telegramConnector, twitchConnector } from "./community";
import { appStoreConnector, g2Connector, playStoreConnector, podcastsConnector, trustpilotConnector } from "./reviews";

const connectors: Connector[] = [
  redditConnector,
  hnConnector,
  rssConnector,
  youtubeConnector,
  xConnector,
  facebookConnector,
  instagramConnector,
  threadsConnector,
  linkedinConnector,
  tiktokConnector,
  googleNewsConnector,
  webSearchConnector,
  googleAlertsConnector,
  googleMapsConnector,
  googleBusinessConnector,
  googleTrendsConnector,
  blueskyConnector,
  mastodonConnector,
  pinterestConnector,
  telegramConnector,
  discordConnector,
  quoraConnector,
  twitchConnector,
  podcastsConnector,
  trustpilotConnector,
  g2Connector,
  appStoreConnector,
  playStoreConnector,
  snapchatConnector,
];

for (const connector of connectors) {
  const meta = SOURCE_CATALOG.find((s) => s.id === connector.id);
  if (meta) connector.capabilities = meta.capabilities;
}

export function listConnectors() {
  return connectors;
}

export function getConnector(id: Source) {
  return connectors.find((c) => c.id === id);
}

export function connectorStatus() {
  return connectors.map((c) => {
    const meta = SOURCE_CATALOG.find((s) => s.id === c.id);
    return {
      id: c.id,
      name: c.name,
      family: c.family,
      keyless: c.keyless,
      configured: c.isConfigured(),
      live: c.isConfigured() || c.keyless,
      notes: meta?.notes ?? [],
      envVars: meta?.envVars ?? [],
      capabilities: c.capabilities,
      docsUrl: c.docsUrl,
    };
  });
}

export const KEYLESS_DEFAULTS: Source[] = [
  "REDDIT",
  "HACKER_NEWS",
  "RSS",
  "GOOGLE_NEWS",
  "BLUESKY",
  "MASTODON",
  "PODCASTS",
];
