import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { schedulePostAction } from "@/lib/actions";
import { Badge, Button, Card, Field } from "@/components/ui";

function monthCells(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  const pad = start.getDay();
  const days: (number | null)[] = [...Array(pad).fill(null), ...Array.from({ length: end.getDate() }, (_, i) => i + 1)];
  return days;
}

export default async function PublishPage() {
  const session = await requireSession();
  const [accounts, posts] = await Promise.all([
    prisma.socialAccount.findMany({ where: { workspaceId: session.workspaceId } }),
    prisma.scheduledPost.findMany({ where: { workspaceId: session.workspaceId }, orderBy: { scheduledAt: "asc" } }),
  ]);
  const now = new Date();
  const cells = monthCells(now);
  const byDay = new Map<number, number>();
  for (const p of posts) {
    if (p.scheduledAt.getMonth() === now.getMonth()) {
      const d = p.scheduledAt.getDate();
      byDay.set(d, (byDay.get(d) ?? 0) + 1);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-semibold">Publisher</h1>
          <p className="text-sm text-muted">Schedule to a connected account, or to the mock X account if none is linked.</p>
        </div>
        <Card>
          <h2 className="mb-3 font-semibold">{now.toLocaleString("en", { month: "long", year: "numeric" })}</h2>
          <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => <div key={d}>{d}</div>)}
            {cells.map((d, i) => (
              <div key={i} className="min-h-14 rounded-lg border border-line/70 p-1 text-ink">
                {d ? (
                  <>
                    <div>{d}</div>
                    {byDay.get(d) ? <div className="mt-1 rounded bg-accent/20 text-[10px] text-accent">{byDay.get(d)} posts</div> : null}
                  </>
                ) : null}
              </div>
            ))}
          </div>
        </Card>
        <div className="space-y-2">
          {posts.map((p) => (
            <Card key={p.id} className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm">{p.content}</p>
                <p className="mt-1 text-xs text-muted">{p.scheduledAt.toLocaleString()} · {p.platforms.join(", ")}</p>
              </div>
              <Badge tone={p.status === "FAILED" ? "bad" : p.status === "PUBLISHED" ? "good" : "accent"}>{p.status.toLowerCase()}</Badge>
            </Card>
          ))}
        </div>
      </div>
      <Card>
        <h2 className="mb-3 font-semibold">Schedule a post</h2>
        <form action={schedulePostAction} className="space-y-3">
          <Field label="Account">
            <select name="accountId" defaultValue="">
              <option value="">Mock X account (no token)</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.displayName} · {a.platform}{a.isMock ? " (mock)" : ""}</option>
              ))}
            </select>
          </Field>
          <Field label="Content">
            <textarea name="content" required rows={5} placeholder="Shipping our listening digest in both English and العربية." />
          </Field>
          <Field label="Schedule at">
            <input name="scheduledAt" type="datetime-local" />
          </Field>
          <Button type="submit">Queue post</Button>
        </form>
      </Card>
    </div>
  );
}
