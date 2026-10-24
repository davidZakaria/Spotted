import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { projectAnalytics } from "@/lib/analytics";
import { Card } from "@/components/ui";
import { SentimentBars, SourcePie, VolumeChart } from "@/components/charts";
import { fetchTrends } from "@/lib/trends";

export default async function AnalyticsPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id } = await params;
  const project = await prisma.project.findFirst({
    where: { id, workspaceId: session.workspaceId },
    include: { keywords: true },
  });
  if (!project) notFound();
  const stats = await projectAnalytics(project.id, 14);
  const keyword = project.keywords[0]?.phrase ?? project.name;
  const trends = await fetchTrends(keyword, stats.series);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Analytics · {project.name}</h1>
        <p className="text-sm text-muted">Volume, reach, sentiment, authors, share of voice, languages, and Trends.</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-semibold">Volume</h2>
          <VolumeChart data={stats.series} />
        </Card>
        <Card>
          <h2 className="mb-3 font-semibold">Sentiment</h2>
          <SentimentBars data={[
            { name: "Positive", value: stats.sentiment.positive },
            { name: "Neutral", value: stats.sentiment.neutral },
            { name: "Negative", value: stats.sentiment.negative },
          ]} />
        </Card>
        <Card>
          <h2 className="mb-3 font-semibold">Sources</h2>
          <SourcePie data={stats.sourceShare} />
        </Card>
        <Card>
          <h2 className="mb-3 font-semibold">Google Trends · {keyword}</h2>
          <p className="mb-2 text-xs text-muted">{trends.source}</p>
          <VolumeChart data={trends.series.map((s: { date: string; value: number }) => ({ date: s.date, volume: s.value }))} />
        </Card>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-semibold">Top authors</h2>
          <ul className="space-y-2 text-sm">
            {stats.topAuthors.map((a) => (
              <li key={a.name} className="flex justify-between border-b border-line/60 pb-2">
                <span>{a.name}</span>
                <span className="text-muted">{a.count} mentions · reach {a.reach}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <h2 className="mb-3 font-semibold">Share of voice & topics</h2>
          <ul className="space-y-2 text-sm">
            {stats.shareOfVoice.map((s) => (
              <li key={s.phrase} className="flex justify-between"><span>{s.phrase}</span><span>{Math.round(s.share * 100)}%</span></li>
            ))}
            {stats.topics.map((t) => (
              <li key={t.topic} className="flex justify-between text-muted"><span>#{t.topic}</span><span>{t.count}</span></li>
            ))}
          </ul>
        </Card>
      </div>
      <Card>
        <h2 className="mb-3 font-semibold">Languages</h2>
        <div className="flex flex-wrap gap-2 text-sm">
          {stats.languages.map((l) => (
            <span key={l.language} className="rounded-full bg-bg-soft px-3 py-1">{l.language} · {l.count}</span>
          ))}
        </div>
      </Card>
    </div>
  );
}
