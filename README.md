# Spotted

See every mention of your brand, understand the mood, and reply from one place. Built for marketers — Home speaks in plain sentences, setup is a five-step wizard, and technical jargon stays out of the interface.

Inspired by Brand24 and Hootsuite. Workspaces, listening across public sites, sentiment (including Arabic / RTL), alerts, a unified inbox, a publishing calendar, and PDF/CSV reports.

## Quick start (Docker Compose)

```bash
cp .env.example .env
# set AUTH_SECRET at minimum
docker compose up --build
```

Open [http://localhost:4721](http://localhost:4721).

Compose starts `spotted-db`, `spotted-redis`, `spotted-web`, and `spotted-worker`. The web process runs `prisma migrate deploy` then `node server.js` immediately — ingest is the worker’s job, so deploys no longer sit on a 502.

Create the first owner (do not leave `SEED_DEMO` on in production):

```bash
OWNER_EMAIL=you@yourbrand.com OWNER_PASSWORD='A-strong-Pass1!' npm run auth:create-owner
# Encrypt any tokens stored before ENCRYPTION_KEY was set:
npm run auth:encrypt-tokens
# If an old demo user exists:
npm run auth:disable-demo          # or: npm run auth:disable-demo -- --delete
```

Local demo seed is opt-in: `SEED_DEMO=true npm run db:seed` (`demo@spotted.app` / `demo1234`).

## Local development

```bash
cp .env.example .env
# DATABASE_URL=postgresql://spotted:spotted@127.0.0.1:5432/spotted
# REDIS_URL=redis://127.0.0.1:6379
# APP_URL=http://127.0.0.1:4721
npx prisma migrate dev
# optional: SEED_DEMO=true npm run db:seed
OWNER_EMAIL=you@yourbrand.com OWNER_PASSWORD='A-strong-Pass1!' npm run auth:create-owner
npm run dev          # http://127.0.0.1:4721
npm run dev:worker   # ingest + publish; web no longer blocks on this
npm test
```

## What you can do

1. Create an owner with `auth:create-owner`, or sign up if `SIGNUP_MODE=open`. First login opens a setup wizard: name your brand, add watch words, add competitors, pick platforms, see first results. Invite teammates by email when `SIGNUP_MODE` is `invite` or `closed`.
2. Home summarizes the day: new mentions, mood, and the biggest spike — in plain language.
3. Mentions is a live search: type any word and we query every working source right away (Reddit, news, YouTube, Bluesky, and more). Save it with **Keep watching this word** for Brand24-style rules (required/excluded words, Boolean, language, country, hyphen variants). A 30-day backfill runs, then the worker refreshes every 5 minutes.
4. Connected platforms shows what works now versus what needs a login, with step-by-step help.
5. Switch English / العربية. Dark and light themes. Arabic mention text renders right-to-left.
6. Schedule a post (a practice account is used until you connect a real one) and export a spreadsheet or PDF.

Public pages (no login; Meta’s crawler can read them): `/privacy`, `/terms`, and `/data-deletion`. Linked in the footer. Data-deletion requests go to `davidsamii97@gmail.com`.

## Connectors

Every source implements the same interface: keyword/hashtag/mention listening, public account/competitor tracking, comments and engagement, plus owned-account OAuth (publish, inbox, reply, own analytics) **as far as that platform’s official API allows**. Connected platforms and the table below mark limits the vendor does not permit. Those are API limits, not unfinished stubs.

| Source | Listening without keys | Needs | Important API limits |
| --- | --- | --- | --- |
| Reddit | Keyword mentions via SerpAPI `site:reddit.com <keyword>` (same monthly budget), labeled Reddit (via Google) | Official `oauth.reddit.com` only after Reddit’s written approval — set `REDDIT_CLIENT_ID` / `REDDIT_CLIENT_SECRET`. No public JSON fallback. | Commercial API use needs Reddit approval (Responsible Builder Policy) |
| Hacker News | Keyword + author + comments | — | No write API |
| RSS / news | Feed URLs | — | No comments |
| Google News | RSS search | — | Index only |
| Google Alerts | User-pasted alert RSS | — | You create the alert on Google |
| Bluesky | Public search + profiles (`api.bsky.app`, then `public.api.bsky.app`) | App password to post, or if public AppView returns 403 | — |
| Mastodon | Instance search / hashtags | OAuth to post / DMs | Search depends on the instance |
| Podcasts | iTunes Search | Podcast Index keys for richer data | No comments |
| Apple App Store | Public review RSS by app id | App Store Connect to reply | — |
| Telegram | Public `t.me/s` channels | Bot token to post / inbox | No global search |
| YouTube | Search with `YOUTUBE_API_KEY` | Google OAuth only to manage / upload to a channel | No DM API |
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

Set `SERPAPI_API_KEY` to search Google web and Google News (engines `google` and `google_news`). The free plan is 250 searches/month — set `SERPAPI_MONTHLY_LIMIT` (default 250). Spotted uses SerpAPI for **Search everywhere** and at most two scheduled refreshes per watched word per day, then falls back to RSS news and other keyless sources. Optional `BRAVE_SEARCH_API_KEY` covers extra web/Quora results without spending SerpAPI.

### X usage budgets

X is pay-per-use. Each call is recorded (`ApiUsage`) with an estimated USD cost (default $0.005, editable). Settings → Connected platforms lets you set daily searches, monthly searches, and a monthly spend cap. When a cap is hit, X listening stops and a brand warning is stored instead of running up the bill.

### Instagram hashtag quota

Meta allows **30 unique hashtags per rolling 7 days per Instagram account**. Reusing a hashtag already counted in the window does not consume quota. Spotted records each new hashtag, skips extras, and surfaces remaining quota on Connected platforms and as a brand warning.

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

OAuth starts at `/api/oauth/meta` (Facebook Login dialog) and the callback is `${APP_URL}/api/oauth/meta/callback`. After the code exchange, Spotted upgrades to a long-lived user token, lists `/me/accounts`, and stores each Page (Page token + linked Instagram Business account) in `SocialAccount`. Ingest then pulls that Page’s posts, comments, and tagged mentions.

Register the Meta redirect as `https://your-host/api/oauth/meta/callback`. Threads uses a separate start URL (`/api/oauth/threads`) and redirect `${APP_URL}/api/oauth/threads/callback`.

## Environment variables

See `.env.example` for the full list. Grouped:

| Group | Variables |
| --- | --- |
| Core | `DATABASE_URL`, `REDIS_URL`, `APP_URL`, `NEXT_PUBLIC_APP_URL`, `AUTH_SECRET` |
| Security | `ENCRYPTION_KEY` (32-byte base64, required in production), `SEED_DEMO` (default off), `SIGNUP_MODE` (`closed` / `invite` / `open`), `SESSION_DAYS`, `LOGIN_MAX_ATTEMPTS`, `LOGIN_LOCKOUT_MINUTES` |

Login, signup, and logout redirects are built from `APP_URL` / `NEXT_PUBLIC_APP_URL`, never from the incoming request host. Set both to the public URL people type in the browser.
| Sentiment | `OPENAI_API_KEY`, `OPENAI_MODEL` (local EN+AR lexicon if unset) |
| Alerts | `SMTP_*`, `SLACK_WEBHOOK_URL` |
| Web search | `SERPAPI_API_KEY`, `SERPAPI_MONTHLY_LIMIT` (default 250), `BRAVE_SEARCH_API_KEY` |
| YouTube | `YOUTUBE_API_KEY`, `GOOGLE_OAUTH_*` |
| X | `TWITTER_BEARER_TOKEN`, `TWITTER_CLIENT_ID`, `TWITTER_CLIENT_SECRET` |
| Meta | `META_APP_ID`, `META_APP_SECRET`, `META_PAGE_ACCESS_TOKEN`, `THREADS_APP_*`, `META_EXTRA_SCOPES` (optional Instagram scopes) |
| LinkedIn | `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET` |
| TikTok | `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET` |
| Google | `GOOGLE_GBP_*`, `GOOGLE_TRENDS_ENABLED` |
| Reddit | Listening uses `SERPAPI_API_KEY`. `REDDIT_CLIENT_ID` / `REDDIT_CLIENT_SECRET` / `REDDIT_USER_AGENT` only after Reddit’s written approval |
| Bluesky | `BLUESKY_HANDLE`, `BLUESKY_APP_PASSWORD` (publish, or if public AppView returns 403) |
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

Covers language/RTL detection, English and Arabic sentiment, the connector capability catalog (including LinkedIn/TikTok limits, IG quota copy, Brave vs CSE), topic extraction, Home insight copy, APP_URL auth redirects, and a Prisma check that `schema.prisma` matches `prisma/migrations` (`npm run db:check`).

## Architecture

- `src/lib/connectors/` — one implementation per source, plus `catalog.ts` (capability matrix), `usage.ts` (X/web-search budgets), `quotas.ts` (IG hashtags).
- `src/lib/jobs/` — ingest, alerts/digests, publish + inbox sync.
- `src/worker.ts` — BullMQ repeats (ingest 15m, alerts 5m, publish 1m, digests daily). If Redis is down, Listen now runs ingest inline.
- Auth is email/password with signed session cookies, workspaces, and roles (`OWNER`, `ADMIN`, `EDITOR`, `VIEWER`).
