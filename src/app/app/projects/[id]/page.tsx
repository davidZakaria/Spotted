import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { projectAnalytics } from "@/lib/analytics";
import { listenNowAction } from "@/lib/actions";
import { Badge, Card, SentimentPill } from "@/components/ui";
import { formatNumber } from "@/lib/utils";
import { VolumeChart } from "@/components/charts";

export default async function ProjectOverview({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted">Project</p>
          <h1 className="text-2xl font-semibold">{project.name}</h1>
          <p className="text-sm text-muted">{project.keywords.map((k) => k.phrase).join(" · ")}</p>
        </div>
        <div className="flex gap-2">
          <form action={listenNowAction.bind(null, project.id)}>
            <button className="rounded-xl bg-accent px-3 py-2 text-sm font-semibold text-bg">Listen now</button>
          </form>
          <Link href={`/app/projects/${project.id}/mentions`} className="rounded-xl border border-line px-3 py-2 text-sm">Mentions</Link>
          <Link href={`/app/projects/${project.id}/analytics`} className="rounded-xl border border-line px-3 py-2 text-sm">Analytics</Link>
          <Link href={`/app/projects/${project.id}/alerts`} className="rounded-xl border border-line px-3 py-2 text-sm">Alerts</Link>
        </div>
      </div>
      {project.warnings.length > 0 && (
        <Card className="border-warn/40">
          <p className="text-sm font-medium text-warn">Connector notices</p>
          <ul className="mt-2 space-y-1 text-sm text-muted">
            {project.warnings.map((w) => (
              <li key={w.id}>{w.source}: {w.message}</li>
            ))}
          </ul>
        </Card>
      )}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card><p className="text-xs text-muted">Volume</p><p className="text-3xl font-semibold">{formatNumber(stats.totals.volume, session.locale)}</p></Card>
        <Card><p className="text-xs text-muted">Reach</p><p className="text-3xl font-semibold">{formatNumber(stats.totals.reach, session.locale)}</p></Card>
        <Card><p className="text-xs text-muted">Engagement</p><p className="text-3xl font-semibold">{formatNumber(stats.totals.engagement, session.locale)}</p></Card>
      </div>
      <Card>
        <h2 className="mb-3 font-semibold">Volume and sentiment</h2>
        <VolumeChart data={stats.series} />
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-semibold">Latest mentions</h2>
          <div className="space-y-3">
            {mentions.map((m) => (
              <a key={m.id} href={m.url} target="_blank" rel="noreferrer" className="block rounded-xl border border-line p-3 hover:bg-bg-soft">
                <div className="flex items-center justify-between text-xs text-muted">
                  <span>{m.source} · {m.authorName || m.authorHandle || "unknown"}</span>
                  <SentimentPill value={m.sentiment} />
                </div>
                <p dir="auto" lang={m.language ?? undefined} className="rtl-content mt-1 line-clamp-3 text-sm">{m.title || m.content}</p>
              </a>
            ))}
          </div>
        </Card>
        <Card>
          <h2 className="mb-3 font-semibold">Share of voice</h2>
          <div className="space-y-2">
            {stats.shareOfVoice.map((row) => (
              <div key={row.phrase} className="flex items-center justify-between text-sm">
                <span>{row.phrase}</span>
                <Badge tone="accent">{Math.round(row.share * 100)}%</Badge>
              </div>
            ))}
            {stats.topics.slice(0, 6).map((t) => (
              <div key={t.topic} className="flex items-center justify-between text-sm text-muted">
                <span>#{t.topic}</span>
                <span>{t.count}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
