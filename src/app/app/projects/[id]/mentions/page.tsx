import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Card, SentimentPill } from "@/components/ui";

export default async function MentionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string; source?: string; sentiment?: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;
  const sp = await searchParams;
  const project = await prisma.project.findFirst({ where: { id, workspaceId: session.workspaceId } });
  if (!project) notFound();
  const mentions = await prisma.mention.findMany({
    where: {
      projectId: id,
      ...(sp.source ? { source: sp.source as never } : {}),
      ...(sp.sentiment ? { sentiment: sp.sentiment as never } : {}),
      ...(sp.q
        ? { OR: [{ content: { contains: sp.q, mode: "insensitive" } }, { title: { contains: sp.q, mode: "insensitive" } }] }
        : {}),
    },
    orderBy: { publishedAt: "desc" },
    take: 80,
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">{project.name} mentions</h1>
        <p className="text-sm text-muted">Arabic and other RTL text render with automatic direction.</p>
      </div>
      <form className="grid gap-2 md:grid-cols-4">
        <input name="q" defaultValue={sp.q} placeholder="Filter text" />
        <input name="source" defaultValue={sp.source} placeholder="Source e.g. REDDIT" />
        <select name="sentiment" defaultValue={sp.sentiment ?? ""}>
          <option value="">All sentiment</option>
          <option value="POSITIVE">Positive</option>
          <option value="NEUTRAL">Neutral</option>
          <option value="NEGATIVE">Negative</option>
        </select>
        <button className="rounded-xl bg-bg-soft">Filter</button>
      </form>
      <div className="space-y-3">
        {mentions.length === 0 ? (
          <Card>No mentions match. Run Listen now from the project overview.</Card>
        ) : mentions.map((m) => (
          <a key={m.id} href={m.url} target="_blank" rel="noreferrer" className="card block p-4 hover:border-accent/40">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
              <span>{m.source} · {m.kind} · {m.authorName || m.authorHandle || "unknown"} · {m.publishedAt.toLocaleString()}</span>
              <span className="flex items-center gap-2">
                {m.language ? <span>{m.language}</span> : null}
                <SentimentPill value={m.sentiment} />
              </span>
            </div>
            {m.title ? <p dir="auto" lang={m.language ?? undefined} className="rtl-content mt-2 font-medium">{m.title}</p> : null}
            <p dir="auto" lang={m.language ?? undefined} className="rtl-content mt-1 text-sm text-muted">{m.content}</p>
            <p className="mt-2 text-xs text-muted">
              reach {m.reach} · likes {m.likeCount} · shares {m.shareCount} · comments {m.commentCount} · views {m.viewCount}
            </p>
          </a>
        ))}
      </div>
    </div>
  );
}
