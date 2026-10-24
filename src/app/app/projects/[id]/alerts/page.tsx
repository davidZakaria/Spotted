import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createAlertAction } from "@/lib/actions";
import { Button, Card, Field } from "@/components/ui";

export default async function AlertsPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id } = await params;
  const project = await prisma.project.findFirst({
    where: { id, workspaceId: session.workspaceId },
    include: { alerts: { include: { events: { take: 5, orderBy: { firedAt: "desc" } } } } },
  });
  if (!project) notFound();

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div>
        <h1 className="text-2xl font-semibold">Alerts · {project.name}</h1>
        <p className="mb-4 text-sm text-muted">Spike and keyword alerts. Email uses SMTP when configured; otherwise they log to the worker. Slack uses a webhook.</p>
        <Card>
          <form action={createAlertAction} className="space-y-3">
            <input type="hidden" name="projectId" value={project.id} />
            <Field label="Name"><input name="name" required defaultValue="Volume spike" /></Field>
            <Field label="Type">
              <select name="type" defaultValue="SPIKE">
                <option value="SPIKE">Spike</option>
                <option value="KEYWORD">Keyword</option>
              </select>
            </Field>
            <Field label="Keyword (for keyword alerts)"><input name="keyword" placeholder="outage" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Spike threshold"><input name="spikeThreshold" type="number" defaultValue={10} /></Field>
              <Field label="Window (minutes)"><input name="windowMinutes" type="number" defaultValue={60} /></Field>
            </div>
            <Field label="Channel">
              <select name="channel" defaultValue="EMAIL">
                <option value="EMAIL">Email</option>
                <option value="SLACK">Slack</option>
                <option value="BOTH">Both</option>
              </select>
            </Field>
            <Field label="Email to"><input name="emailTo" type="email" defaultValue={session.email} /></Field>
            <Field label="Slack webhook"><input name="slackWebhook" placeholder="https://hooks.slack.com/..." /></Field>
            <Button type="submit">Save alert</Button>
          </form>
        </Card>
      </div>
      <div className="space-y-3">
        {project.alerts.map((alert) => (
          <Card key={alert.id}>
            <p className="font-medium">{alert.name}</p>
            <p className="text-sm text-muted">{alert.type} · {alert.channel} · {alert.enabled ? "on" : "off"}</p>
            <ul className="mt-3 space-y-1 text-xs text-muted">
              {alert.events.length === 0 ? <li>No firings yet.</li> : alert.events.map((e) => (
                <li key={e.id}>{e.firedAt.toLocaleString()} — {e.summary}</li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </div>
  );
}
