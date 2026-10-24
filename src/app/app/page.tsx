import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { workspaceOverview } from "@/lib/analytics";
import { biggestSpike, homeHeadline, sentimentMood } from "@/lib/insights";
import { Card, HelpTip, PageHeader } from "@/components/ui";
import { MentionCard } from "@/components/mention-card";
import { VolumeChart } from "@/components/charts";
import { formatNumber } from "@/lib/utils";
import { t } from "@/lib/i18n";
import { platformInfo } from "@/lib/platforms";
import { listenNowAction } from "@/lib/actions";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string }>;
}) {
  const session = await requireSession();
  const locale = session.locale === "ar" ? "ar" : "en";
  const { welcome } = await searchParams;
  const projectCount = await prisma.project.count({ where: { workspaceId: session.workspaceId } });
  if (projectCount === 0) redirect("/app/onboarding");

  const stats = await workspaceOverview(session.workspaceId);
  const mood = sentimentMood(stats.sentiment);
  const spike = biggestSpike(stats.series);
  const headline = homeHeadline({
    todayCount: stats.todayMentions,
    weekCount: stats.mentions,
    mood,
    spike,
    locale,
  });
  const topPlatform = stats.topSource ? platformInfo(stats.topSource[0] as never) : null;
  const firstBrand = await prisma.project.findFirst({
    where: { workspaceId: session.workspaceId },
    orderBy: { updatedAt: "desc" },
  });

  const cards = locale === "ar"
    ? [
        { title: "إشارات اليوم", value: formatNumber(stats.todayMentions, locale), body: "منشورات جديدة منذ منتصف الليل.", tip: "كل مرة يذكر فيها أحد كلماتك على المواقع المتصلة." },
        { title: "مزاج الأسبوع", value: mood.ar, body: `${stats.sentiment.positive} إيجابي · ${stats.sentiment.neutral} محايد · ${stats.sentiment.negative} سلبي`, tip: "نقرأ الكلمات السعيدة والحزينة في النص. ليست مثالية، لكنها تعطيك اتجاهاً سريعاً." },
        { title: "أكبر ارتفاع", value: spike ? `${spike.volume}` : "—", body: spike ? `كان ذلك يوم ${spike.date}` : "لا يوجد ارتفاع بعد. اضغط ابحث عن إشارات جديدة.", tip: "اليوم الذي تحدث فيه الناس عنك أكثر من غيره." },
        { title: "أكثر منصة", value: topPlatform ? (locale === "ar" ? topPlatform.nameAr : topPlatform.name) : "—", body: topPlatform ? `${stats.topSource?.[1]} إشارة هذا الأسبوع` : "اربط منصات أو ابدأ البحث." },
      ]
    : [
        { title: "New mentions today", value: formatNumber(stats.todayMentions, locale), body: "Fresh posts since midnight.", tip: "A mention is any public post that includes your watch words." },
        { title: "Mood this week", value: mood.en.replace(/\.$/, ""), body: `${stats.sentiment.positive} positive · ${stats.sentiment.neutral} mixed · ${stats.sentiment.negative} negative`, tip: "We read happy and unhappy words in the text. It is a quick steer, not a perfect score." },
        { title: "Biggest spike", value: spike ? String(spike.volume) : "—", body: spike ? `That was ${spike.date}` : "No spike yet. Tap Find new mentions.", tip: "The day people talked about you the most." },
        { title: "Busiest platform", value: topPlatform?.name ?? "—", body: topPlatform ? `${stats.topSource?.[1]} mentions this week` : "Connect platforms or run a search." },
      ];

  return (
    <div className="space-y-6">
      {welcome ? (
        <Card className="border-accent/40 bg-accent/5">
          <p className="font-semibold">{locale === "ar" ? "أولى نتائجك جاهزة" : "Your first results are in"}</p>
          <p className="mt-1 text-sm text-muted">
            {locale === "ar"
              ? "هذه نظرة سريعة. افتح الإشارات لقراءة كل منشور، أو التحليلات للرسوم."
              : "This is your snapshot. Open Mentions to read every post, or Analytics for the charts."}
          </p>
        </Card>
      ) : null}

      <PageHeader
        title={locale === "ar" ? `مرحباً ${session.name.split(" ")[0]}` : `Hi ${session.name.split(" ")[0]}`}
        description={headline}
        tip={locale === "ar" ? "الرئيسية تلخص اليوم في جملة واحدة." : "Home sums up today in one sentence."}
        actions={
          firstBrand ? (
            <form action={listenNowAction.bind(null, firstBrand.id)}>
              <button className="rounded-xl bg-accent px-3 py-2 text-sm font-semibold text-accent-ink">{t(locale, "listenNow")}</button>
            </form>
          ) : null
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.title}>
            <p className="text-xs font-medium uppercase tracking-wide text-muted">
              {card.title}
              {card.tip ? <HelpTip text={card.tip} /> : null}
            </p>
            <p className="mt-2 text-2xl font-semibold leading-tight">{card.value}</p>
            <p className="mt-1 text-sm text-muted">{card.body}</p>
          </Card>
        ))}
      </div>

      <Card>
        <div className="mb-1 flex items-center justify-between">
          <h2 className="font-semibold">
            {locale === "ar" ? "الإشارات عبر الأيام" : "Mentions over the last week"}
            <HelpTip text={locale === "ar" ? "كل نقطة هي يوم. الارتفاع يعني أن الناس تحدثوا عنك أكثر." : "Each point is a day. A rise means more people talked about you."} />
          </h2>
          <Link href="/app/analytics" className="text-sm text-accent">{t(locale, "analytics")}</Link>
        </div>
        <p className="mb-4 text-sm text-muted">
          {locale === "ar" ? "كم مرة ظهرت كلماتك كل يوم." : "How often your words showed up each day."}
        </p>
        <VolumeChart data={stats.series} />
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">{locale === "ar" ? "آخر ما قيل" : "Latest mentions"}</h2>
            <Link href="/app/mentions" className="text-sm text-accent">{t(locale, "mentions")}</Link>
          </div>
          {stats.recent.length === 0 ? (
            <Card>
              <p className="text-sm text-muted">{t(locale, "emptyMentions")}</p>
            </Card>
          ) : stats.recent.map((mention) => (
            <MentionCard key={mention.id} mention={mention} locale={locale} />
          ))}
        </div>
        <Card>
          <h2 className="mb-3 font-semibold">{locale === "ar" ? "ماذا بعد؟" : "What to do next"}</h2>
          <ul className="space-y-3 text-sm">
            <li><Link className="text-accent" href="/app/mentions">{locale === "ar" ? "اقرأ الإشارات الجديدة" : "Read new mentions"}</Link> — {locale === "ar" ? "وانظر إن كان المزاج إيجابياً." : "and check whether the mood is friendly."}</li>
            <li><Link className="text-accent" href="/app/alerts">{locale === "ar" ? "اضبط تنبيهاً" : "Set an alert"}</Link> — {locale === "ar" ? "ليصلك بريد عندما يرتفع الحديث فجأة." : "so email arrives when conversation suddenly jumps."}</li>
            <li><Link className="text-accent" href="/app/publish">{locale === "ar" ? "جدول منشوراً" : "Schedule a post"}</Link> — {locale === "ar" ? "من تقويم بسيط." : "from a simple calendar."}</li>
            <li><Link className="text-accent" href="/app/settings/platforms">{locale === "ar" ? "اربط المزيد من المنصات" : "Connect more platforms"}</Link> — {locale === "ar" ? "مثل فيسبوك أو إنستغرام." : "like Facebook or Instagram."}</li>
            <li><Link className="text-accent" href="/app/help">{t(locale, "howItWorks")}</Link></li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
