import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id } = await params;
  const report = await prisma.report.findFirst({
    where: { id, workspaceId: session.workspaceId },
  });
  if (!report?.filePath) return new NextResponse("Not found", { status: 404 });
  const buf = await readFile(report.filePath);
  const type = report.format === "PDF" ? "application/pdf" : "text/csv";
  return new NextResponse(buf, {
    headers: {
      "Content-Type": type,
      "Content-Disposition": `attachment; filename="spotted-report.${report.format.toLowerCase()}"`,
    },
  });
}
