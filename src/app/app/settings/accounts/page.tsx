import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Badge, Card } from "@/components/ui";

const providers = [
  { id: "meta", label: "Meta (Facebook Pages, Instagram, Messenger)" },
  { id: "x", label: "X" },
  { id: "linkedin", label: "LinkedIn Company Page" },
  { id: "google", label: "Google (YouTube + Business Profile)" },
];

export default async function AccountsPage() {
  const session = await requireSession();
  const accounts = await prisma.socialAccount.findMany({
    where: { workspaceId: session.workspaceId },
    orderBy: { createdAt: "desc" },
  });
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Connected accounts</h1>
        <p className="text-sm text-muted">OAuth unlocks publishing, inbox, and owned-account analytics. Missing env vars send you back here with an error.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {providers.map((p) => (
          <a key={p.id} href={`/api/oauth/${p.id}`} className="rounded-xl border border-line px-3 py-2 text-sm hover:bg-bg-soft">{p.label}</a>
        ))}
      </div>
      <div className="space-y-2">
        {accounts.map((a) => (
          <Card key={a.id} className="flex items-center justify-between">
            <div>
              <p className="font-medium">{a.displayName}</p>
              <p className="text-xs text-muted">{a.platform} · @{a.handle}</p>
            </div>
            <Badge tone={a.isMock ? "warn" : "good"}>{a.isMock ? "mock" : a.status}</Badge>
          </Card>
        ))}
      </div>
    </div>
  );
}
