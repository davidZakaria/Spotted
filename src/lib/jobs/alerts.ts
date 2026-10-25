import { prisma } from "../db";
import { appConfig, env } from "../config";

async function notify(channel: "EMAIL" | "SLACK" | "BOTH", subject: string, body: string, emailTo?: string | null, slackWebhook?: string | null) {
  const webhook = slackWebhook || appConfig.slackWebhook;
  if ((channel === "SLACK" || channel === "BOTH") && webhook) {
    await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: `*${subject}*\n${body}` }),
    });
  }
  if (channel === "EMAIL" || channel === "BOTH") {
    if (env("SMTP_HOST") && emailTo) {
      const nodemailer = await import("nodemailer");
      const transport = nodemailer.createTransport({
        host: env("SMTP_HOST"),
        port: Number(env("SMTP_PORT", "587")),
        auth: env("SMTP_USER") ? { user: env("SMTP_USER"), pass: env("SMTP_PASS") } : undefined,
      });
      await transport.sendMail({
        from: env("SMTP_FROM", "Spotted <alerts@localhost>"),
        to: emailTo,
        subject,
        text: body,
      });
    } else {
      console.log(`[alert:email] ${subject}\n${body}`);
    }
  }
}

export async function evaluateAlerts(projectId?: string) {
  const alerts = await prisma.alert.findMany({
    where: { enabled: true, ...(projectId ? { projectId } : {}) },
    include: { project: true },
  });
  let fired = 0;
  for (const alert of alerts) {
    if (alert.type === "SPIKE") {
      const windowMs = (alert.windowMinutes || 60) * 60 * 1000;
      const since = new Date(Date.now() - windowMs);
      const count = await prisma.mention.count({
        where: { projectId: alert.projectId, publishedAt: { gte: since } },
      });
      const threshold = alert.spikeThreshold ?? 20;
      if (count >= threshold) {
        const summary = `${alert.project.name}: ${count} mentions in the last ${alert.windowMinutes} minutes (threshold ${threshold}).`;
        await prisma.alertEvent.create({ data: { alertId: alert.id, summary, payload: { count, threshold } } });
        await prisma.alert.update({ where: { id: alert.id }, data: { lastFiredAt: new Date() } });
        await notify(alert.channel, `Spotted spike: ${alert.name}`, summary, alert.emailTo, alert.slackWebhook);
        fired += 1;
      }
    } else if (alert.type === "KEYWORD" && alert.keyword) {
      const since = alert.lastFiredAt ?? new Date(Date.now() - 60 * 60 * 1000);
      const matches = await prisma.mention.findMany({
        where: {
          projectId: alert.projectId,
          collectedAt: { gt: since },
          OR: [
            { content: { contains: alert.keyword, mode: "insensitive" } },
            { title: { contains: alert.keyword, mode: "insensitive" } },
          ],
        },
        take: 15,
      });
      if (matches.length) {
        const summary = `${alert.project.name}: ${matches.length} new mentions contain “${alert.keyword}”.`;
        await prisma.alertEvent.create({ data: { alertId: alert.id, summary, payload: { ids: matches.map((m) => m.id) } } });
        await prisma.alert.update({ where: { id: alert.id }, data: { lastFiredAt: new Date() } });
        await notify(alert.channel, `Spotted keyword: ${alert.name}`, summary, alert.emailTo, alert.slackWebhook);
        fired += 1;
      }
    } else if (alert.type === "COMPLAINT") {
      const since = alert.lastFiredAt ?? new Date(Date.now() - 60 * 60 * 1000);
      const matches = await prisma.mention.findMany({
        where: {
          projectId: alert.projectId,
          collectedAt: { gt: since },
          complaint: true,
        },
        take: 15,
      });
      if (matches.length) {
        const summary = `${alert.project.name}: ${matches.length} new complaint or risk mentions (scam, lawsuit, استغاثة).`;
        await prisma.alertEvent.create({ data: { alertId: alert.id, summary, payload: { ids: matches.map((m) => m.id) } } });
        await prisma.alert.update({ where: { id: alert.id }, data: { lastFiredAt: new Date() } });
        await notify(alert.channel, `Spotted complaints: ${alert.name}`, summary, alert.emailTo, alert.slackWebhook);
        fired += 1;
      }
    }
  }
  return { fired };
}

export async function sendDigests() {
  const digests = await prisma.digest.findMany({ where: { enabled: true }, include: { project: true, workspace: true } });
  for (const digest of digests) {
    const since = digest.lastSentAt ?? new Date(Date.now() - 24 * 60 * 60 * 1000);
    const where = {
      collectedAt: { gte: since },
      ...(digest.projectId ? { projectId: digest.projectId } : { project: { workspaceId: digest.workspaceId } }),
    };
    const count = await prisma.mention.count({ where });
    const body = `Digest for ${digest.project?.name ?? digest.workspace.name}: ${count} new mentions since ${since.toISOString()}.`;
    await notify(digest.channel, "Spotted digest", body, digest.emailTo, digest.slackWebhook);
    await prisma.digest.update({ where: { id: digest.id }, data: { lastSentAt: new Date() } });
  }
}
