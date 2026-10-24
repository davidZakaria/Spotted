import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Card } from "@/components/ui";

export default async function SettingsPage() {
  const session = await requireSession();
  const members = await prisma.membership.count({ where: { workspaceId: session.workspaceId } });
  const accounts = await prisma.socialAccount.count({ where: { workspaceId: session.workspaceId } });
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <div className="grid gap-4 md:grid-cols-3">
        <Link href="/app/settings/members"><Card><p className="text-xs text-muted">Workspace</p><p className="mt-1 font-semibold">{session.workspaceName}</p><p className="text-sm text-muted">{members} members · your role {session.role}</p></Card></Link>
        <Link href="/app/settings/accounts"><Card><p className="text-xs text-muted">Connected accounts</p><p className="mt-1 text-3xl font-semibold">{accounts}</p><p className="text-sm text-muted">OAuth + mock</p></Card></Link>
        <Link href="/app/settings/sources"><Card><p className="text-xs text-muted">Sources</p><p className="mt-1 font-semibold">Capability matrix</p><p className="text-sm text-muted">Budgets, quotas, API limits</p></Card></Link>
      </div>
    </div>
  );
}
