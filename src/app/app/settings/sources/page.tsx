import { requireSession } from "@/lib/auth";
import { connectorStatus } from "@/lib/connectors/registry";
import { usageSummary } from "@/lib/connectors/usage";
import { instagramHashtagStatus } from "@/lib/connectors/quotas";
import { prisma } from "@/lib/db";
import { updateBudgetAction } from "@/lib/actions";
import { Badge, Button, Card, Field } from "@/components/ui";
import { formatUsd } from "@/lib/utils";

export default async function SourcesPage() {
  const session = await requireSession();
  const sources = connectorStatus();
  const xUsage = await usageSummary(session.workspaceId, "X");
  const igAccount = await prisma.socialAccount.findFirst({
    where: { workspaceId: session.workspaceId, platform: "INSTAGRAM" },
  });
  const igQuota = await instagramHashtagStatus(igAccount?.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Sources & API limits</h1>
        <p className="text-sm text-muted">
          Every connector implements listening, public-account tracking, comments, and owned-account management as far as the official API allows. Red badges are platform limitations, not missing product work.
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="font-semibold">X pay-per-use budget</h2>
          <p className="mt-1 text-sm text-muted">
            {xUsage.dailyCalls} calls today · {xUsage.monthlyCalls} this month · {formatUsd(xUsage.monthlySpendUsd, session.locale)} estimated
          </p>
          <form action={updateBudgetAction} className="mt-3 grid grid-cols-3 gap-2">
            <Field label="Daily calls"><input name="dailyCallLimit" type="number" defaultValue={xUsage.budget?.dailyCallLimit ?? 50} /></Field>
            <Field label="Monthly calls"><input name="monthlyCallLimit" type="number" defaultValue={xUsage.budget?.monthlyCallLimit ?? 500} /></Field>
            <Field label="Monthly $"><input name="monthlySpendLimitUsd" type="number" step="0.01" defaultValue={xUsage.budget?.monthlySpendLimitUsd ?? 25} /></Field>
            <div className="col-span-3"><Button type="submit">Save X budget</Button></div>
          </form>
        </Card>
        <Card>
          <h2 className="font-semibold">Instagram hashtag quota</h2>
          <p className="mt-1 text-sm text-muted">
            Meta allows 30 unique hashtags per 7 days per IG account. Used {igQuota.used} / 30. Remaining {igQuota.remaining}.
          </p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-bg-soft">
            <div className="h-full bg-accent" style={{ width: `${(igQuota.used / 30) * 100}%` }} />
          </div>
          <p className="mt-2 text-xs text-muted">{igQuota.hashtags.length ? igQuota.hashtags.map((h) => `#${h}`).join(" ") : "No hashtags consumed this window."}</p>
        </Card>
      </div>
      <div className="space-y-4">
        {sources.map((s) => (
          <Card key={s.id}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-semibold">{s.name}</h2>
                <p className="text-xs text-muted">{s.family} · {s.keyless ? "Keyless listening" : s.envVars.join(", ") || "Credentials required"}</p>
              </div>
              <div className="flex gap-2">
                <Badge tone={s.configured || s.keyless ? "good" : "warn"}>{s.configured || s.keyless ? "ready" : "needs keys"}</Badge>
                <a href={s.docsUrl} className="text-xs text-accent" target="_blank" rel="noreferrer">API docs</a>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {s.capabilities.map((c) => (
                <span
                  key={c.key}
                  title={c.limitation ?? c.auth}
                  className={`rounded-full px-2 py-0.5 text-[11px] ${c.available ? "bg-good/10 text-good" : "bg-bad/10 text-bad line-through decoration-transparent"}`}
                >
                  {c.available ? c.key.replaceAll("_", " ") : `${c.key.replaceAll("_", " ")} — ${c.limitation ?? "not permitted"}`}
                </span>
              ))}
            </div>
            {s.notes.map((n) => (
              <p key={n} className="mt-2 text-xs text-muted">{n}</p>
            ))}
          </Card>
        ))}
      </div>
    </div>
  );
}
