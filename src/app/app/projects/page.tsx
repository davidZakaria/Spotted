import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Card, EmptyState } from "@/components/ui";

export default async function ProjectsPage() {
  const session = await requireSession();
  const projects = await prisma.project.findMany({
    where: { workspaceId: session.workspaceId },
    include: { keywords: true, _count: { select: { mentions: true } } },
    orderBy: { updatedAt: "desc" },
  });
  if (!projects.length) {
    return (
      <EmptyState
        title="No listening projects yet"
        body="Create a keyword project. Spotted will pull live mentions from Reddit, Hacker News, Google News, Bluesky, Mastodon, and RSS without API keys."
        action={<Link href="/app/projects/new" className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-bg">New project</Link>}
      />
    );
  }
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Projects</h1>
        <Link href="/app/projects/new" className="rounded-xl bg-accent px-3 py-2 text-sm font-semibold text-bg">New project</Link>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {projects.map((p) => (
          <Link key={p.id} href={`/app/projects/${p.id}`}>
            <Card className="h-full hover:border-accent/50">
              <h2 className="font-semibold">{p.name}</h2>
              <p className="mt-1 text-sm text-muted">{p.description || "Keyword listening project"}</p>
              <p className="mt-3 text-xs text-muted">{p.keywords.map((k) => k.phrase).join(" · ") || "No keywords"}</p>
              <p className="mt-2 text-sm">{p._count.mentions} mentions stored</p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
