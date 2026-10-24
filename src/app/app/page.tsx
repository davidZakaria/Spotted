import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { workspaceOverview } from "@/lib/analytics";
import { Card } from "@/components/ui";
import { formatNumber } from "@/lib/utils";
import { SentimentPill } from "@/components/ui";

export default async function DashboardPage() {
  const session = await requireSession();
  const stats = await workspaceOverview(session.workspaceId);
  const projects = await prisma.project.findMany({
    where: { workspaceId: session.workspaceId },
    include: { _count: { select: { mentions: true, alerts: true } } },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Workspace pulse</h1>
        <p className="text-sm text-muted">Last 7 days across every listening project in {session.workspaceName}.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Active projects", stats.projects],
          ["Mentions (7d)", stats.mentions],
          ["Live alerts", stats.alerts],
          ["Scheduled posts", stats.posts],
        ].map(([label, value]) => (
          <Card key={String(label)}>
            <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
            <p className="mt-2 text-3xl font-semibold">{formatNumber(Number(value), session.locale)}</p>
          </Card>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Projects</h2>
            <Link href="/app/projects/new" className="text-sm text-accent">New</Link>
          </div>
          <div className="space-y-2">
            {projects.length === 0 ? (
              <p className="text-sm text-muted">Create a keyword project to start listening.</p>
            ) : projects.map((p) => (
              <Link key={p.id} href={`/app/projects/${p.id}`} className="flex items-center justify-between rounded-xl border border-line px-3 py-2 hover:bg-bg-soft">
                <div>
                  <p className="font-medium">{p.name}</p>
                  <p className="text-xs text-muted">{p._count.mentions} mentions · {p._count.alerts} alerts</p>
                </div>
                <span className="text-xs text-muted">{p.status.toLowerCase()}</span>
              </Link>
            ))}
          </div>
        </Card>
        <Card>
          <h2 className="mb-3 font-semibold">Latest mentions</h2>
          <div className="space-y-3">
            {stats.recent.map((m) => (
              <div key={m.id} className="rounded-xl border border-line p-3">
                <div className="flex items-center justify-between gap-2 text-xs text-muted">
                  <span>{m.source} · {m.project.name}</span>
                  <SentimentPill value={m.sentiment} />
                </div>
                <p dir="auto" className="rtl-content mt-1 line-clamp-2 text-sm">{m.title || m.content}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
