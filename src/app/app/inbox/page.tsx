import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { replyInboxAction } from "@/lib/actions";
import { Badge, Card, EmptyState } from "@/components/ui";

export default async function InboxPage() {
  const session = await requireSession();
  const items = await prisma.inboxItem.findMany({
    where: { workspaceId: session.workspaceId },
    include: { account: true },
    orderBy: { receivedAt: "desc" },
    take: 80,
  });
  if (!items.length) {
    return (
      <EmptyState
        title="Inbox is empty"
        body="Connect a Page, IG, X, YouTube, or GBP account to pull comments, DMs, and reviews. Demo workspaces also seed sample threads."
      />
    );
  }
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Unified inbox</h1>
        <p className="text-sm text-muted">Comments, mentions, Messenger/DMs, and reviews where each API allows replies.</p>
      </div>
      <div className="space-y-3">
        {items.map((item) => (
          <Card key={item.id}>
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
              <span>{item.platform} · {item.type} · {item.authorName} · {item.receivedAt.toLocaleString()}</span>
              <Badge tone={item.status === "REPLIED" ? "good" : "muted"}>{item.status.toLowerCase()}</Badge>
            </div>
            <p dir="auto" lang={item.language ?? undefined} className="rtl-content mt-2 text-sm">{item.content}</p>
            {item.status !== "REPLIED" ? (
              <form action={replyInboxAction} className="mt-3 flex gap-2">
                <input type="hidden" name="id" value={item.id} />
                <input name="message" placeholder="Reply…" className="flex-1" />
                <button className="rounded-xl bg-accent px-3 text-sm font-semibold text-bg">Reply</button>
              </form>
            ) : null}
          </Card>
        ))}
      </div>
    </div>
  );
}
