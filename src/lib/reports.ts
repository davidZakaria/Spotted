import { createWriteStream } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import PDFDocument from "pdfkit";
import { prisma } from "./db";
import { projectAnalytics } from "./analytics";

function reportsDir() {
  return path.join(process.cwd(), "reports");
}

export async function buildCsvReport(projectId: string, from: Date, to: Date) {
  const mentions = await prisma.mention.findMany({
    where: { projectId, publishedAt: { gte: from, lte: to } },
    orderBy: { publishedAt: "desc" },
  });
  const header = [
    "publishedAt",
    "source",
    "author",
    "title",
    "content",
    "sentiment",
    "language",
    "reach",
    "engagement",
    "likes",
    "shares",
    "views",
    "url",
  ];
  const rows = mentions.map((m) =>
    [
      m.publishedAt.toISOString(),
      m.source,
      m.authorName ?? m.authorHandle ?? "",
      (m.title ?? "").replaceAll('"', "'"),
      (m.content ?? "").replaceAll('"', "'").replaceAll("\n", " "),
      m.sentiment,
      m.language ?? "",
      m.reach,
      m.engagement,
      m.likeCount,
      m.shareCount,
      m.viewCount,
      m.url,
    ]
      .map((v) => `"${String(v).replaceAll('"', '""')}"`)
      .join(","),
  );
  const csv = [header.join(","), ...rows].join("\n");
  await mkdir(reportsDir(), { recursive: true });
  const filePath = path.join(reportsDir(), `${projectId}-${Date.now()}.csv`);
  await writeFile(filePath, csv, "utf8");
  return filePath;
}

export async function buildPdfReport(projectId: string, from: Date, to: Date) {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  const stats = await projectAnalytics(projectId, Math.max(1, Math.ceil((to.getTime() - from.getTime()) / 86400000)));
  await mkdir(reportsDir(), { recursive: true });
  const filePath = path.join(reportsDir(), `${projectId}-${Date.now()}.pdf`);

  await new Promise<void>((resolve, reject) => {
    const doc = new PDFDocument({ margin: 48 });
    const stream = createWriteStream(filePath);
    doc.pipe(stream);
    doc.fontSize(20).text("Spotted listening report", { align: "left" });
    doc.moveDown(0.3);
    doc.fontSize(12).fillColor("#444").text(project?.name ?? projectId);
    doc.text(`${from.toISOString().slice(0, 10)} → ${to.toISOString().slice(0, 10)}`);
    doc.moveDown();
    doc.fillColor("#111").fontSize(14).text("Summary");
    doc.fontSize(11).text(`Volume: ${stats.totals.volume}`);
    doc.text(`Reach: ${stats.totals.reach}`);
    doc.text(`Engagement: ${stats.totals.engagement}`);
    doc.text(`Positive / Neutral / Negative: ${stats.sentiment.positive} / ${stats.sentiment.neutral} / ${stats.sentiment.negative}`);
    doc.moveDown();
    doc.fontSize(14).text("Share of voice");
    for (const row of stats.shareOfVoice) {
      doc.fontSize(11).text(`${row.phrase}: ${row.count} (${Math.round(row.share * 100)}%)`);
    }
    doc.moveDown();
    doc.fontSize(14).text("Trending topics");
    for (const topic of stats.topics) {
      doc.fontSize(11).text(`${topic.topic} (${topic.count})`);
    }
    doc.end();
    stream.on("finish", () => resolve());
    stream.on("error", reject);
  });
  return filePath;
}
