import type { Mention, Sentiment, Source } from "@prisma/client";
import { PlatformLogo, PlatformName } from "@/components/platform-logo";
import { Badge, SentimentPill } from "@/components/ui";
import { t } from "@/lib/i18n";
import { truncate } from "@/lib/utils";
import { HISTORY_SCAN_KIND, HISTORY_SCAN_LABEL, HISTORY_SCAN_LABEL_AR } from "@/lib/listen/backfill";

type MentionLike = Pick<
  Mention,
  "id" | "url" | "title" | "content" | "authorName" | "authorHandle" | "source" | "sentiment" | "publishedAt" | "language"
> & { project?: { name: string }; kind?: string | null; complaint?: boolean | null; rating?: number | null };

export function MentionCard({
  mention,
  locale = "en",
}: {
  mention: MentionLike;
  locale?: string;
}) {
  const author = mention.authorName || mention.authorHandle || (locale === "ar" ? "شخص ما" : "Someone");
  const when = mention.publishedAt.toLocaleString(locale === "ar" ? "ar" : "en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  return (
    <a
      href={mention.url}
      target="_blank"
      rel="noreferrer"
      className="card block p-4 transition hover:border-accent/40"
    >
      <div className="flex items-start gap-3">
        <PlatformLogo id={mention.source as Source} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
              <span className="font-medium text-ink">{author}</span>
              <span>
                on <PlatformName id={mention.source as Source} locale={locale} />
                {(mention.source === "REDDIT" || mention.source === "QUORA") && mention.kind === "via_google"
                  ? locale === "ar"
                    ? " (عبر جوجل)"
                    : " (via Google)"
                  : null}
                {mention.kind === HISTORY_SCAN_KIND
                  ? locale === "ar"
                    ? ` · ${HISTORY_SCAN_LABEL_AR}`
                    : ` · ${HISTORY_SCAN_LABEL}`
                  : null}
              </span>
              {mention.project ? <span>· {mention.project.name}</span> : null}
              <span>· {when}</span>
            </div>
            <span className="flex flex-wrap items-center gap-1.5">
              {mention.rating != null ? (
                <Badge tone={mention.rating <= 2 ? "bad" : mention.rating >= 4 ? "good" : "muted"}>
                  {mention.rating}★
                </Badge>
              ) : null}
              {mention.complaint ? (
                <Badge tone="bad">{t(locale, "complaintsRisk")}</Badge>
              ) : null}
              <SentimentPill value={mention.sentiment as Sentiment} locale={locale} />
            </span>
          </div>
          {mention.title ? (
            <p dir="auto" lang={mention.language ?? undefined} className="rtl-content mt-2 font-medium">
              {mention.title}
            </p>
          ) : null}
          <p dir="auto" lang={mention.language ?? undefined} className="rtl-content mt-1 text-sm text-muted">
            {truncate(mention.content, 240)}
          </p>
          <p className="mt-2 text-xs font-medium text-accent">{t(locale, "openOriginal")} →</p>
        </div>
      </div>
    </a>
  );
}
