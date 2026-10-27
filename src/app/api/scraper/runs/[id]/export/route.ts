import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { itemsToCsv } from "@/lib/scrape/tools";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireSession();
  const { id } = await params;
  const run = await prisma.scrapeRun.findFirst({ where: { id, workspaceId: session.workspaceId } });
  if (!run) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const items = Array.isArray(run.items) ? (run.items as Record<string, unknown>[]) : [];
  const csv = itemsToCsv(items);
  const format = new URL(request.url).searchParams.get("format");
  const filename = `${run.title.replace(/[^\w.-]+/g, "-").slice(0, 40) || "scrape"}.${format === "xls" ? "xls" : "csv"}`;
  return new NextResponse(csv, {
    headers: {
      "Content-Type": format === "xls" ? "application/vnd.ms-excel; charset=utf-8" : "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
