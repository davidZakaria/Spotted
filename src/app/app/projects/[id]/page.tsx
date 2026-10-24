import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { projectAnalytics } from "@/lib/analytics";
import { listenNowAction } from "@/lib/actions";
import { ChartBlock, PageHeader } from "@/components/ui";
import { MentionCard } from "@/components/mention-card";
import { VolumeChart } from "@/components/charts";
import { formatNumber } from "@/lib/utils";
import { t } from "@/lib/i18n";

export default async function ProjectOverview({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const locale = session.locale === "ar" ? "ar" : "en";
  const { id } = await params;
  const project = await prisma.project.findFirst({
    where: { id, workspaceId: session.workspaceId },
    include: { keywords: true, warnings: { where: { resolved: false }, take: 5, orderBy: { createdAt: "desc" } } },
  });
  if (!project) notFound();
  const stats = await projectAnalytics(project.id, 7);
  const mentions = await prisma.mention.findMany({
    where: { projectId: project.id },
    orderBy: { publishedAt: "desc" },
    take: 8,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title={project.name}
        description={project.keywords.map((k) => k.phrase).join(" · ") || (locale === "ar" ? "لا كلمات مراقبة بعد" : "No watch words yet")}
        actions={
          <>
            <form action={listenNowAction.bind(null, project.id)}>
              <button className="rounded-xl bg-accent px-3 py-2 text-sm font-semibold text-accent-ink">{t(locale, "listenNow")}</button>
            </form>
            <Link href={`/app/mentions?brand=${project.id}`} className="rounded-xl border border-line px-3 py-2 text-sm">{t(locale, "mentions")}</Link>
            <Link href={`/app/analytics?brand=${project.id}`} className="rounded-xl border border-line px-3 py-2 text-sm">{t(locale, "analytics")}</Link>
            <Link href={`/app/alerts?brand=${project.id}`} className="rounded-xl border border-line px-3 py-2 text-sm">{t(locale, "alerts")}</Link>
          </>
        }
      />
      {project.warnings.length > 0 && (
        <div className="card border-warn/40 p-5">
          <p className="text-sm font-medium text-warn">{locale === "ar" ? "ملاحظات المنصات" : "Platform notes"}</p>
          <ul className="mt-2 space-y-1 text-sm text-muted">
            {project.warnings.map((w) => (
              <li key={w.id}>{w.message}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card p-5">
          <p className="text-xs text-muted">{locale === "ar" ? "إشارات هذا الأسبوع" : "Mentions this week"}</p>
          <p className="text-3xl font-semibold">{formatNumber(stats.totals.volume, locale)}</p>
        </div>
        <div className="card p-5">
          <p className="text-xs text-muted">{locale === "ar" ? "مدى الوصول التقريبي" : "Approximate reach"}</p>
          <p className="text-3xl font-semibold">{formatNumber(stats.totals.reach, locale)}</p>
        </div>
        <div className="card p-5">
          <p className="text-xs text-muted">{locale === "ar" ? "تفاعل" : "Engagement"}</p>
          <p className="text-3xl font-semibold">{formatNumber(stats.totals.engagement, locale)}</p>
        </div>
      </div>
      <ChartBlock
        title={locale === "ar" ? "الإشارات والمزاج" : "Mentions and mood"}
        explanation={locale === "ar" ? "كيف تحرك الحديث هذا الأسبوع." : "How conversation moved this week."}
      >
        <VolumeChart data={stats.series} />
      </ChartBlock>
      <div className="space-y-3">
        <h2 className="font-semibold">{locale === "ar" ? "آخر الإشارات" : "Latest mentions"}</h2>
        {mentions.map((mention) => (
          <MentionCard key={mention.id} mention={mention} locale={locale} />
        ))}
      </div>
    </div>
  );
}
