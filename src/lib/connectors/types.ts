import type { Source } from "@prisma/client";
export type { Source };

export type Capability =
  | "keyword_search"
  | "hashtag_search"
  | "mention_listen"
  | "public_account_track"
  | "competitor_track"
  | "comments"
  | "replies"
  | "engagement_metrics"
  | "publish"
  | "schedule"
  | "inbox_comments"
  | "inbox_dms"
  | "inbox_reviews"
  | "reply"
  | "own_analytics"
  | "upload_media";

export type AuthMode = "none" | "api_key" | "oauth" | "bot" | "rss";

export type CapStatus = {
  key: Capability;
  available: boolean;
  auth: AuthMode;
  limitation?: string;
};

export type ProjectConfig = {
  sources?: Source[];
  rssFeeds?: string[];
  googleAlertFeeds?: string[];
  telegramChannels?: string[];
  mastodonInstances?: string[];
  facebookPageIds?: string[];
  instagramHashtags?: string[];
  instagramUserIds?: string[];
  youtubeChannelIds?: string[];
  redditSubreddits?: string[];
  appStoreIds?: string[];
  playStoreIds?: string[];
  competitors?: string[];
  languages?: string[];
  webSearchProvider?: "brave" | "serpapi";
  podcastQueries?: string[];
  backfilledAt?: string;
  excludeWords?: string[];
  googleMapsPlaces?: GoogleMapsPlace[];
  googleMapsIntervalHours?: number;
};

export type GoogleMapsPlace = {
  dataId?: string;
  placeId?: string;
  label: string;
  query?: string;
  mapsUrl?: string;
  lastFetchedAt?: string;
};

export type ConnectorContext = {
  query: string;
  language?: string;
  country?: string;
  since?: Date;
  limit?: number;
  projectId?: string;
  workspaceId?: string;
  projectConfig?: ProjectConfig;
  accessToken?: string;
  accountId?: string;
  accountExternalId?: string;
  purpose?: "live" | "scheduled" | "backfill";
  keywordKey?: string;
  extraQueries?: string[];
  preferEgyptNews?: boolean;
  serpQuery?: string;
  skipSerp?: boolean;
};

export type RawMention = {
  source: Source;
  externalId: string;
  url: string;
  title?: string;
  content: string;
  authorName?: string;
  authorHandle?: string;
  authorUrl?: string;
  publishedAt: Date;
  language?: string;
  reach?: number;
  engagement?: number;
  likeCount?: number;
  shareCount?: number;
  viewCount?: number;
  commentCount?: number;
  followerCount?: number;
  kind?: string;
  parentExternalId?: string;
  rating?: number;
  raw?: unknown;
};

export type InboxPayload = {
  externalId: string;
  type: "COMMENT" | "MENTION" | "MESSAGE" | "REVIEW" | "REACTION" | "TAG";
  authorName: string;
  content: string;
  url?: string;
  receivedAt: Date;
};

export type PublishInput = {
  content: string;
  mediaUrls?: string[];
  accessToken?: string;
  accountExternalId?: string;
};

export type OwnAnalytics = {
  followers: number;
  impressions: number;
  engagements: number;
  period: string;
  series: { date: string; impressions: number; engagements: number }[];
};

export interface Connector {
  id: Source;
  name: string;
  family: string;
  docsUrl: string;
  keyless: boolean;
  capabilities: CapStatus[];
  isConfigured(): boolean;
  search(ctx: ConnectorContext): Promise<RawMention[]>;
  trackAccounts?(ctx: ConnectorContext): Promise<RawMention[]>;
  fetchComments?(ctx: ConnectorContext & { externalId: string }): Promise<RawMention[]>;
  fetchInbox?(ctx: ConnectorContext): Promise<InboxPayload[]>;
  publish?(input: PublishInput): Promise<{ externalId: string; url?: string }>;
  reply?(ctx: ConnectorContext & { externalId: string; message: string }): Promise<void>;
  ownAnalytics?(ctx: ConnectorContext): Promise<OwnAnalytics>;
}

export function cap(
  key: Capability,
  available: boolean,
  auth: AuthMode,
  limitation?: string,
): CapStatus {
  return { key, available, auth, limitation };
}
