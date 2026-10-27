import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getBrand, listBrands } from "@/lib/workspace";
import { BrandSwitcher } from "@/components/brand-switcher";
import { MentionCard } from "@/components/mention-card";
import { LiveSearch } from "@/components/live-search";
import { TopicCloud } from "@/components/topic-cloud";
import { Button, ChartBlock, EmptyState, PageHeader } from "@/components/ui";
import { SentimentBars, VolumeChart } from "@/components/charts";
import { t } from "@/lib/i18n";
import { listenNowAction, searchPastYearAction } from "@/lib/actions";
import { PLATFORMS } from "@/lib/platforms";
import { projectAnalytics } from "@/lib/analytics";
import { influenceScore } from "@/lib/listen/dedupe";
import { serpUsageSummary } from "@/lib/listen/serpapi";
import { formatNumber } from "@/lib/utils";
import type { Sentiment, Source } from "@prisma/client";
import type { ProjectConfig } from "@/lib/connectors/types";
import { mentionRoles, readBrandProfile } from "@/lib/listen/profile";

export default async function MentionsPage({
  searchParams,
}: {
  searchParams: Promise<{
    brand?: string;
    q?: string;
    source?: string;
    sentiment?: string;
    language?: string;
    from?: string;
    to?: string;
    influence?: string;
    keyword?: string;
    risk?: string;
    who?: string;
  }>;
}) {
  const session = await requireSession();
  const locale = session.locale === "ar" ? "ar" : "en";
  const sp = await searchParams;
  const [brands, brand] = await Promise.all([
    listBrands(session.workspaceId),
    getBrand(session.workspaceId, sp.brand),
  ]);

  if (!brand) {
    return (
      <EmptyState
        title={locale === "ar" ? "لا توجد علامة بعد" : "Add a brand first"}
        body={locale === "ar" ? "سمِّ علامتك وأضف كلمات للمراقبة لنبدأ بالبحث." : "Name your brand and add words to watch so we can start looking."}
        action={<Link href="/app/onboarding" className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-ink">{t(locale, "newBrand")}</Link>}
      />
    );
  }

  const from = sp.from ? new Date(sp.from) : new Date(Date.now() - 30 * 86400000);
  const to = sp.to ? new Date(`${sp.to}T23:59:59`) : new Date();
  const minInfluence = Number(sp.influence ?? 0) || 0;
  const stats = await projectAnalytics(brand.id, 30);
  const serp = await serpUsageSummary(session.workspaceId);

  const stored = await prisma.mention.findMany({
    where: {
      projectId: brand.id,
      publishedAt: { gte: from, lte: to },
      ...(sp.source ? { source: sp.source as Source } : {}),
      ...(sp.sentiment ? { sentiment: sp.sentiment as Sentiment } : {}),
      ...(sp.language ? { language: sp.language } : {}),
      ...(sp.keyword ? { keywordId: sp.keyword } : {}),
      ...(sp.risk === "complaint" ? { complaint: true } : {}),
      ...(sp.q
        ? { OR: [{ content: { contains: sp.q, mode: "insensitive" } }, { title: { contains: sp.q, mode: "insensitive" } }] }
        : {}),
    },
    orderBy: { publishedAt: "desc" },
    take: 120,
  });
  const profile = readBrandProfile((brand.config ?? {}) as ProjectConfig);
  const who = sp.who || (profile.hideOwnPosts ? "others" : "");
  const mentions = stored.filter((mention) => {
    if (influenceScore(mention) < minInfluence) return false;
    const roles = mentionRoles(mention, profile);
    if (who === "others" && roles.includes("own")) return false;
    if (who === "own") return roles.includes("own");
    if (who === "competitor") return roles.includes("competitor");
    if (who === "person") return roles.includes("person");
    if (who === "product") return roles.includes("product");
    return true;
  });
  const languages = [...new Set(stored.map((mention) => mention.language).filter(Boolean))] as string[];

  return (
    <div className="space-y-5">
      <PageHeader
        title={t(locale, "mentions")}
        description={locale === "ar"
          ? "ابحث في كل المنصات العاملة الآن، ثم احفظ الكلمة لنراقبها باستمرار."
          : "Search every working site right now, then save the word so we keep watching it."}
        tip={locale === "ar" ? "real-estate و real estate تُعاملان ككلمة واحدة." : "Hyphens and spaces are treated as the same word — real-estate also finds real estate."}
        actions={
          <>
            <form action={listenNowAction.bind(null, brand.id)}>
              <button className="rounded-xl bg-accent px-3 py-2 text-sm font-semibold text-accent-ink">{t(locale, "listenNow")}</button>
            </form>
            <form action={searchPastYearAction}>
              <input type="hidden" name="projectId" value={brand.id} />
              <Button type="submit" variant="soft">{locale === "ar" ? "ابحث في السنة الماضية" : "Search past year"}</Button>
            </form>
          </>
        }
      />
      <BrandSwitcher brands={brands} currentId={brand.id} path="/app/mentions" label={t(locale, "brands")} />
      <p className="text-sm">
        <Link href={`/app/projects/${brand.id}`} className="text-accent">
          {locale === "ar" ? "ملف العلامة وإعداد المراقبة" : "Brand profile and listening setup"}
        </Link>
      </p>

      <LiveSearch
        projectId={brand.id}
        locale={locale}
        initialQuery={sp.q ?? ""}
        watching={brand.keywords.map((keyword) => keyword.phrase)}
        serpHasKey={serp.hasKey}
        serpRemaining={serp.remaining}
        serpLimit={serp.limit}
      />

      <div className="grid gap-4 lg:grid-cols-4">
        <div className="card p-4">
          <p className="text-xs text-muted">{locale === "ar" ? "إشارات 30 يوماً" : "Mentions · 30 days"}</p>
          <p className="text-2xl font-semibold">{formatNumber(stats.totals.volume, locale)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-muted">{locale === "ar" ? "وصول / تأثير" : "Reach / influence"}</p>
          <p className="text-2xl font-semibold">{formatNumber(stats.totals.reach, locale)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-muted">{locale === "ar" ? "المزاج الإيجابي" : "Positive mood"}</p>
          <p className="text-2xl font-semibold">{formatNumber(stats.sentiment.positive, locale)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-muted">{locale === "ar" ? "كتّاب مميزون" : "Distinct authors"}</p>
          <p className="text-2xl font-semibold">{formatNumber(stats.totals.authors, locale)}</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartBlock
          title={locale === "ar" ? "حجم الإشارات" : "Mention volume"}
          explanation={locale === "ar" ? "كم مرة ذُكرت كل يوم خلال شهر." : "How often you were mentioned each day this month."}
        >
          <VolumeChart data={stats.series} />
        </ChartBlock>
        <ChartBlock
          title={locale === "ar" ? "المزاج" : "Sentiment"}
          explanation={locale === "ar" ? "سعيد، مختلط، أو منزعج." : "Happy, mixed, or upset."}
        >
          <SentimentBars
            data={[
              { name: t(locale, "positive"), value: stats.sentiment.positive },
              { name: t(locale, "neutral"), value: stats.sentiment.neutral },
              { name: t(locale, "negative"), value: stats.sentiment.negative },
            ]}
          />
        </ChartBlock>
        <ChartBlock
          title={locale === "ar" ? "أبرز الكتّاب" : "Top authors"}
          explanation={locale === "ar" ? "من يتحدث عنك أكثر." : "Who talks about you most."}
        >
          <ul className="space-y-2 text-sm">
            {stats.topAuthors.length ? stats.topAuthors.map((author) => (
              <li key={author.name} className="flex justify-between gap-2">
                <span>{author.name}</span>
                <span className="text-muted">{author.count} · {formatNumber(author.reach, locale)}</span>
              </li>
            )) : <p className="text-sm text-muted">{locale === "ar" ? "لا كتّاب بعد." : "No authors yet."}</p>}
          </ul>
        </ChartBlock>
        <ChartBlock
          title={locale === "ar" ? "كلمات رائجة" : "Trending words"}
          explanation={locale === "ar" ? "الكلمات التي تتكرر مع إشاراتك." : "Words that keep showing up with your mentions."}
        >
          <TopicCloud topics={stats.topics} empty={locale === "ar" ? "ستظهر الكلمات بعد أول بحث." : "Words will appear after the first search."} />
        </ChartBlock>
        <ChartBlock
          title={locale === "ar" ? "حصة الصوت بين الكلمات" : "Share of voice"}
          explanation={locale === "ar" ? "أي كلمة مراقبة تظهر أكثر." : "Which watched word appears more often."}
          className="lg:col-span-2"
        >
          <ul className="space-y-2">
            {stats.shareOfVoice.length ? stats.shareOfVoice.map((row) => (
              <li key={row.phrase}>
                <div className="mb-1 flex justify-between text-sm">
                  <span>{row.phrase}</span>
                  <span className="text-muted">{row.count}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-bg-soft">
                  <div className="h-full bg-accent" style={{ width: `${Math.round(row.share * 100)}%` }} />
                </div>
              </li>
            )) : <p className="text-sm text-muted">{locale === "ar" ? "احفظ كلمة لنحسب حصتها." : "Keep watching a word to see its share."}</p>}
          </ul>
        </ChartBlock>
      </div>

      <form className="grid gap-2 md:grid-cols-7">
        <input name="q" defaultValue={sp.q} placeholder={locale === "ar" ? "كلمة للبحث المباشر" : "Word for live search"} />
        <select name="source" defaultValue={sp.source ?? ""}>
          <option value="">{locale === "ar" ? "كل المنصات" : "All platforms"}</option>
          {PLATFORMS.map((platform) => (
            <option key={platform.id} value={platform.id}>{locale === "ar" ? platform.nameAr : platform.name}</option>
          ))}
        </select>
        <select name="sentiment" defaultValue={sp.sentiment ?? ""}>
          <option value="">{locale === "ar" ? "كل المشاعر" : "All moods"}</option>
          <option value="POSITIVE">{t(locale, "positive")}</option>
          <option value="NEUTRAL">{t(locale, "neutral")}</option>
          <option value="NEGATIVE">{t(locale, "negative")}</option>
        </select>
        <select name="risk" defaultValue={sp.risk ?? ""}>
          <option value="">{locale === "ar" ? "كل الإشارات" : "All mentions"}</option>
          <option value="complaint">{t(locale, "complaintsRisk")}</option>
        </select>
        <select name="language" defaultValue={sp.language ?? ""}>
          <option value="">{locale === "ar" ? "كل اللغات" : "All languages"}</option>
          <option value="en">English</option>
          <option value="ar">{locale === "ar" ? "العربية" : "Arabic"}</option>
          {languages.filter((language) => language !== "en" && language !== "ar").map((language) => (
            <option key={language} value={language}>{language}</option>
          ))}
        </select>
        <input type="date" name="from" defaultValue={sp.from ?? from.toISOString().slice(0, 10)} />
        <input type="date" name="to" defaultValue={sp.to ?? to.toISOString().slice(0, 10)} />
        <select name="influence" defaultValue={sp.influence ?? ""}>
          <option value="">{locale === "ar" ? "أي تأثير" : "Any influence"}</option>
          <option value="10">{locale === "ar" ? "تأثير 10+" : "Influence 10+"}</option>
          <option value="50">{locale === "ar" ? "تأثير 50+" : "Influence 50+"}</option>
          <option value="200">{locale === "ar" ? "تأثير 200+" : "Influence 200+"}</option>
        </select>
        <select name="who" defaultValue={who}>
          <option value="">{locale === "ar" ? "الكل" : "Everyone"}</option>
          <option value="others">{locale === "ar" ? "الآخرون فقط" : "Others only"}</option>
          <option value="own">{locale === "ar" ? "منشورنا" : "Own posts"}</option>
          <option value="competitor">{locale === "ar" ? "منافس" : "Competitor"}</option>
          <option value="person">{locale === "ar" ? "شخص" : "Person"}</option>
          <option value="product">{locale === "ar" ? "منتج" : "Product"}</option>
        </select>
        <select name="keyword" defaultValue={sp.keyword ?? ""}>
          <option value="">{locale === "ar" ? "كل الكلمات" : "All watched words"}</option>
          {brand.keywords.map((keyword) => (
            <option key={keyword.id} value={keyword.id}>{keyword.phrase}</option>
          ))}
        </select>
        {sp.brand ? <input type="hidden" name="brand" value={brand.id} /> : null}
        <button className="rounded-xl bg-bg-soft">{locale === "ar" ? "تصفية المحفوظ" : "Filter saved"}</button>
      </form>

      <div className="space-y-3">
        <h2 className="font-semibold">{locale === "ar" ? "المحفوظ لهذه العلامة" : "Saved for this brand"}</h2>
        {mentions.length === 0 ? (
          <EmptyState
            title={
              sp.q
                ? locale === "ar"
                  ? `ابحث في كل مكان عن «${sp.q}»`
                  : `Search everywhere for “${sp.q}”`
                : locale === "ar"
                  ? "لا إشارات محفوظة بعد"
                  : "No saved mentions yet"
            }
            body={
              sp.q
                ? locale === "ar"
                  ? "الصندوق أعلاه يبحث الآن في ريديت والأخبار ويوتيوب وغيرها. اضغط «ابحث في كل مكان»."
                  : "The box above searches Reddit, news, YouTube and more right now. Press Search everywhere."
                : locale === "ar"
                  ? "اكتب كلمة واضغط «ابحث في كل مكان» — لا نكتفي بتصفية ما حفظناه."
                  : "Type a word and press Search everywhere — we don’t only filter what we already saved."
            }
          />
        ) : mentions.map((mention) => (
          <MentionCard
            key={mention.id}
            mention={{ ...mention, roles: mentionRoles(mention, profile) }}
            locale={locale}
          />
        ))}
      </div>
    </div>
  );
}
