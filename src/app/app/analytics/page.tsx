import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { getBrand, listBrands } from "@/lib/workspace";
import { projectAnalytics } from "@/lib/analytics";
import { fetchTrends } from "@/lib/trends";
import { BrandSwitcher } from "@/components/brand-switcher";
import { ChartBlock, EmptyState, PageHeader } from "@/components/ui";
import { SentimentBars, SourcePie, VolumeChart } from "@/components/charts";
import { t } from "@/lib/i18n";
import { platformInfo } from "@/lib/platforms";

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ brand?: string }>;
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
        title={locale === "ar" ? "لا رسوم بعد" : "Nothing to chart yet"}
        body={locale === "ar" ? "أضف علامة أولاً لنرسم الإشارات." : "Add a brand first so we can draw the charts."}
        action={<Link href="/app/onboarding" className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-ink">{t(locale, "newBrand")}</Link>}
      />
    );
  }

  const stats = await projectAnalytics(brand.id, 14);
  const keyword = brand.keywords[0]?.phrase ?? brand.name;
  const trends = await fetchTrends(keyword, stats.series);
  const sourceRows = stats.sourceShare.map((row) => ({
    source: locale === "ar" ? (platformInfo(row.source)?.nameAr ?? row.source) : (platformInfo(row.source)?.name ?? row.source),
    count: row.count,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title={t(locale, "analytics")}
        description={locale === "ar"
          ? `كيف يتحدث الناس عن ${brand.name} خلال أسبوعين.`
          : `How people have been talking about ${brand.name} over the last two weeks.`}
        tip={locale === "ar" ? "مرّر على أي رسم لرؤية الأرقام." : "Hover any chart to see the numbers."}
      />
      <BrandSwitcher brands={brands} currentId={brand.id} path="/app/analytics" label={t(locale, "brands")} />
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartBlock
          title={locale === "ar" ? "كم مرة ذُكرت" : "How often you were mentioned"}
          explanation={locale === "ar" ? "كل يوم كم منشوراً وجدنا." : "How many posts we found each day."}
          tip={locale === "ar" ? "الارتفاع المفاجئ قد يعني خبراً أو شكوى." : "A sudden jump can mean news, a launch, or a complaint."}
        >
          <VolumeChart data={stats.series} />
        </ChartBlock>
        <ChartBlock
          title={locale === "ar" ? "المزاج" : "The mood"}
          explanation={locale === "ar" ? "كم منشوراً بدا سعيداً أو محايداً أو منزعجاً." : "How many posts sounded happy, mixed, or upset."}
          tip={locale === "ar" ? "نعتمد على الكلمات في النص، لا على نبرة الصوت." : "We look at words in the text, not tone of voice."}
        >
          <SentimentBars data={[
            { name: t(locale, "positive"), value: stats.sentiment.positive },
            { name: t(locale, "neutral"), value: stats.sentiment.neutral },
            { name: t(locale, "negative"), value: stats.sentiment.negative },
          ]} />
        </ChartBlock>
        <ChartBlock
          title={locale === "ar" ? "من أين جاءت الإشارات" : "Where mentions came from"}
          explanation={locale === "ar" ? "أي المواقع تحدثت عنك أكثر." : "Which sites talked about you the most."}
        >
          <SourcePie data={sourceRows} />
        </ChartBlock>
        <ChartBlock
          title={locale === "ar" ? `الاهتمام عبر الزمن · ${keyword}` : `Interest over time · ${keyword}`}
          explanation={locale === "ar" ? "هل يبحث الناس عن هذه الكلمة أكثر؟" : "Are people searching for this word more often?"}
          tip={trends.source}
        >
          <VolumeChart data={trends.series.map((s: { date: string; value: number }) => ({ date: s.date, volume: s.value }))} />
        </ChartBlock>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartBlock
          title={locale === "ar" ? "أكثر من يتحدث" : "People talking the most"}
          explanation={locale === "ar" ? "الحسابات التي ذكرتك مراراً." : "Accounts that mentioned you again and again."}
        >
          {stats.topAuthors.length === 0 ? (
            <p className="text-sm text-muted">{locale === "ar" ? "لا أسماء بعد. ابحث عن إشارات جديدة." : "No names yet. Find new mentions first."}</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {stats.topAuthors.map((author) => (
                <li key={author.name} className="flex justify-between border-b border-line/60 pb-2">
                  <span>{author.name}</span>
                  <span className="text-muted">{author.count}</span>
                </li>
              ))}
            </ul>
          )}
        </ChartBlock>
        <ChartBlock
          title={locale === "ar" ? "حصة كل كلمة" : "Which watch words won"}
          explanation={locale === "ar" ? "أي كلماتك ظهرت أكثر." : "Which of your words showed up most."}
        >
          {stats.shareOfVoice.length === 0 ? (
            <p className="text-sm text-muted">{locale === "ar" ? "أضف كلمات للمراقبة أولاً." : "Add watch words first."}</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {stats.shareOfVoice.map((row) => (
                <li key={row.phrase} className="flex justify-between">
                  <span>{row.phrase}</span>
                  <span>{Math.round(row.share * 100)}%</span>
                </li>
              ))}
            </ul>
          )}
        </ChartBlock>
      </div>
    </div>
  );
}
