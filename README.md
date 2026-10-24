# Spotted everywhere

Social listening and publishing platform inspired by Brand24 and Hootsuite. Multi-tenant workspaces, pluggable connectors, sentiment (including Arabic), alerts, a unified inbox, a publishing calendar, and PDF/CSV reports.

## Quick start (Docker Compose)

```bash
cp .env.example .env
# set AUTH_SECRET at minimum
docker compose up --build
```

Open [http://localhost:4721](http://localhost:4721).

**Demo login:** `demo@spotted.app` / `demo1234`

Compose starts `spotted-db`, `spotted-redis`, `spotted-web`, and `spotted-worker`. On first boot it migrates and seeds a workspace, a keyword project, an alert, a mock X account, a scheduled post, and live mentions from keyless sources.

## Local development

```bash
cp .env.example .env
# DATABASE_URL=postgresql://spotted:spotted@127.0.0.1:5432/spotted
# REDIS_URL=redis://127.0.0.1:6379
# APP_URL=http://127.0.0.1:4721
npx prisma migrate dev
npm run db:seed
npm run dev          # http://127.0.0.1:4721
npm run dev:worker   # optional, ingest still runs inline if Redis is down
npm test
```

## What you can do

1. Sign up (or use the demo user) and land in a workspace with roles.
2. Create a keyword project. Keyless sources listen immediately.
3. Open the project to see real mentions, sentiment, volume/reach charts, share of voice, and topics.
4. Create a spike or keyword alert (email and/or Slack).
5. Schedule a post on the calendar — uses a mock X account when nothing is connected.
6. Export CSV or PDF reports.
7. Switch the UI to العربية. Mention cards use `dir="auto"` so Arabic renders RTL.

## Connectors

Every source implements the same interface: keyword/hashtag/mention listening, public account/competitor tracking, comments and engagement, plus owned-account OAuth (publish, inbox, reply, own analytics) **as far as that platform’s official API allows**. The Sources page and the table below mark capabilities that the vendor does not permit. Those are API limits, not unfinished stubs.

| Source | Listening without keys | Needs | Important API limits |
| --- | --- | --- | --- |
| Reddit | Keyword + subreddit + comments | OAuth to post / inbox | — |
| Hacker News | Keyword + author + comments | — | No write API |
| RSS / news | Feed URLs | — | No comments |
| Google News | RSS search | — | Index only |
| Google Alerts | User-pasted alert RSS | — | You create the alert on Google |
| Bluesky | Public search + profiles | App password to post | — |
| Mastodon | Instance search / hashtags | OAuth to post / DMs | Search depends on the instance |
| Podcasts | iTunes Search | Podcast Index keys for richer data | No comments |
| Apple App Store | Public review RSS by app id | App Store Connect to reply | — |
| Telegram | Public `t.me/s` channels | Bot token to post / inbox | No global search |
| YouTube | — | `YOUTUBE_API_KEY`; OAuth for upload + Analytics | No DM API |
| Web search | — | `BRAVE_SEARCH_API_KEY` (default) or `SERPAPI_API_KEY` | Not a social network |
| Quora / forums | — | Same web-search keys (`site:quora.com`) | No official Quora API |
| X | — | Bearer + OAuth | **Pay-per-use.** Workspace daily/monthly call and $ budgets are enforced. |
| Facebook Pages | — | Meta app + Page token / OAuth | No global keyword search. **Public competitor Pages need Page Public Content Access (App Review).** |
| Instagram | — | Meta OAuth (Business/Creator) | **Hashtag search: 30 unique hashtags / 7 days / account** (enforced in-product). No public keyword firehose. Competitor = Business Discovery only. |
| Threads | — | Threads / Meta OAuth | No DM API |
| LinkedIn | — | Company Page OAuth | **No public keyword search, no competitor tracking.** Own Page only. |
| TikTok | — | TikTok OAuth | **Own account only. No competitor access** on commercial APIs. |
| Pinterest | — | OAuth | Pin search + publish. No comment/DM inbox. |
| Discord | — | Bot in each server | No global search |
| Twitch | — | Client id/secret | Search + public channels. No VOD upload. Whispers restricted. |
| Google Business Profile | — | GBP OAuth | Own locations only (reviews + local posts) |
| Google Trends | Widget | — | No official API; falls back to mention volume |
| Trustpilot | — | API key | Competitor units depend on your license |
| G2 | — | Seller / data token | Competitor dumps are licensed |
| Google Play | — | Play service account | **Own apps only** |
| Snapchat | — | Marketing API OAuth | **Publishing + owned analytics only. No listening.** |

### Web search providers

Google Custom Search JSON API is **closed to new customers** and **shuts down 1 January 2027**. Spotted does not use it.

Set `WEB_SEARCH_PROVIDER=brave` (default) with `BRAVE_SEARCH_API_KEY`, or `WEB_SEARCH_PROVIDER=serpapi` with `SERPAPI_API_KEY`. The project can override the provider. Quora/forum listening uses the same provider with a `site:` filter.

### X usage budgets

X is pay-per-use. Each call is recorded (`ApiUsage`) with an estimated USD cost (default $0.005, editable). Settings → Sources lets you set daily calls, monthly calls, and a monthly spend cap. When a cap is hit, X ingest stops and a project warning is stored instead of running up the bill.

### Instagram hashtag quota

Meta allows **30 unique hashtags per rolling 7 days per Instagram account**. Reusing a hashtag already counted in the window does not consume quota. Spotted records each new hashtag, skips extras, and surfaces remaining quota on the Sources page and as a project warning.

## Meta app review (Facebook + Instagram)

Create an app at [developers.facebook.com](https://developers.facebook.com). Add Facebook Login, Instagram Graph API, Messenger, and (if needed) Webhooks.

### Page Public Content Access (competitor / public Pages)

This is a **feature**, not a permission. Until App Review approves PPCA, Graph only returns Pages your testers admin.

1. Development mode: add testers, connect Pages you admin, confirm posts/comments/reactions ingest.
2. Record a screencast of competitor Page monitoring (Page IDs on a project → Listen now → mentions).
3. Submit **Page Public Content Access** with the screencast, privacy policy URL, and a written use case (brand + competitor listening).
4. Switch the app to Live after approval.

### Permissions to request

**Owned Facebook Pages**

- `pages_show_list`
- `pages_read_engagement`
- `pages_read_user_content`
- `pages_manage_metadata`
- `pages_manage_posts`
- `pages_manage_engagement`
- `pages_messaging`
- `business_management`

**Owned Instagram Business / Creator**

- `instagram_basic`
- `instagram_manage_comments`
- `instagram_manage_insights`
- `instagram_content_publish`
- `instagram_manage_messages`
- `pages_show_list` (the IG user is reached through a linked Page)

OAuth starts at `/api/oauth/meta` and requests this set. Messenger inbox, Page ratings, hashtag search, Business Discovery, and Content Publishing each fail closed if a permission is missing.

## Environment variables

See `.env.example` for the full list. Grouped:

| Group | Variables |
| --- | --- |
| Core | `DATABASE_URL`, `REDIS_URL`, `APP_URL`, `AUTH_SECRET` |
| Sentiment | `OPENAI_API_KEY`, `OPENAI_MODEL` (local EN+AR lexicon if unset) |
| Alerts | `SMTP_*`, `SLACK_WEBHOOK_URL` |
| Web search | `WEB_SEARCH_PROVIDER`, `BRAVE_SEARCH_API_KEY`, `SERPAPI_API_KEY` |
| YouTube | `YOUTUBE_API_KEY`, `GOOGLE_OAUTH_*` |
| X | `TWITTER_BEARER_TOKEN`, `TWITTER_CLIENT_ID`, `TWITTER_CLIENT_SECRET` |
| Meta | `META_APP_ID`, `META_APP_SECRET`, `META_PAGE_ACCESS_TOKEN`, `THREADS_APP_*` |
| LinkedIn | `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET` |
| TikTok | `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET` |
| Google | `GOOGLE_GBP_*`, `GOOGLE_TRENDS_ENABLED` |
| Reddit | `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET` (optional) |
| Bluesky | `BLUESKY_HANDLE`, `BLUESKY_APP_PASSWORD` (publish) |
| Mastodon | `MASTODON_INSTANCE`, `MASTODON_CLIENT_*` |
| Pinterest / Telegram / Discord / Twitch / Snap | matching `*_CLIENT_*` / bot tokens |
| Podcasts | `PODCAST_INDEX_API_KEY`, `PODCAST_INDEX_API_SECRET` |
| Reviews | `TRUSTPILOT_API_KEY`, `G2_API_TOKEN`, `APPSTORE_*`, `GOOGLE_PLAY_JSON` |

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind 4 · Prisma 6 · Postgres · Redis / BullMQ · Vitest

## Tests

```bash
npm test
```

Covers language/RTL detection, English and Arabic sentiment, the connector capability catalog (including LinkedIn/TikTok limits, IG quota copy, Brave vs CSE), topic extraction, and config defaults.

## Architecture

- `src/lib/connectors/` — one implementation per source, plus `catalog.ts` (capability matrix), `usage.ts` (X/web-search budgets), `quotas.ts` (IG hashtags).
- `src/lib/jobs/` — ingest, alerts/digests, publish + inbox sync.
- `src/worker.ts` — BullMQ repeats (ingest 15m, alerts 5m, publish 1m, digests daily). If Redis is down, Listen now runs ingest inline.
- Auth is email/password with signed session cookies, workspaces, and roles (`OWNER`, `ADMIN`, `EDITOR`, `VIEWER`).
