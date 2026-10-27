import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { listBrands } from "@/lib/workspace";
import { saveScrapeListAction, saveScrapeToMentionsAction } from "@/lib/actions";
import { scrapeColumns, scrapeTool } from "@/lib/scrape/tools";
import { Button, Card, Field, PageHeader } from "@/components/ui";

export default async function ScrapeRunPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const locale = session.locale === "ar" ? "ar" : "en";
  const ar = locale === "ar";
  const { id } = await params;
  const [run, brands] = await Promise.all([
    prisma.scrapeRun.findFirst({ where: { id, workspaceId: session.workspaceId } }),
    listBrands(session.workspaceId),
  ]);
  if (!run) notFound();
  const tool = scrapeTool(run.toolId);
  const items = Array.isArray(run.items) ? (run.items as Record<string, unknown>[]) : [];
  const columns = scrapeColumns(items);
  const csvHref = `/api/scraper/runs/${run.id}/export?format=csv`;
  const xlsHref = `/api/scraper/runs/${run.id}/export?format=xls`;

  return (
    <div className="space-y-5">
      <PageHeader
        title={run.title}
        description={`${ar ? (tool?.nameAr ?? run.toolId) : (tool?.name ?? run.toolId)} · ${run.status}`}
        actions={<Link href="/app/scraper" className="rounded-xl border border-line px-3 py-2 text-sm">{ar ? "كل الأدوات" : "All tools"}</Link>}
      />
      {run.error ? (
        <Card className="border-bad/40">
          <p className="font-medium text-bad">{ar ? "لم يكتمل التشغيل" : "This run did not finish"}</p>
          <p className="mt-1 text-sm text-muted">{run.error}</p>
        </Card>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-4">
        <Card><p className="text-xs text-muted">{ar ? "الصفوف" : "Rows"}</p><p className="text-2xl font-semibold">{run.itemCount}</p></Card>
        <Card><p className="text-xs text-muted">{ar ? "التقدير" : "Estimate"}</p><p className="text-2xl font-semibold">${run.estimatedCostUsd.toFixed(2)}</p></Card>
        <Card><p className="text-xs text-muted">{ar ? "الحالة" : "Status"}</p><p className="text-2xl font-semibold">{run.status}</p></Card>
        <Card>
          <p className="text-xs text-muted">{ar ? "تصدير" : "Export"}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <a className="rounded-xl border border-line px-3 py-1.5 text-sm" href={csvHref}>{ar ? "CSV" : "CSV"}</a>
            <a className="rounded-xl border border-line px-3 py-1.5 text-sm" href={xlsHref}>{ar ? "إكسل" : "Excel"}</a>
          </div>
        </Card>
      </div>

      {run.status === "SUCCEEDED" ? (
        <Card>
          <div className="grid gap-4 md:grid-cols-2">
            <form action={saveScrapeToMentionsAction} className="space-y-2">
              <input type="hidden" name="runId" value={run.id} />
              <Field label={ar ? "حفظ في الإشارات" : "Save to Mentions"}>
                <select name="projectId" required defaultValue={run.projectId ?? brands[0]?.id ?? ""}>
                  {brands.map((brand) => (
                    <option key={brand.id} value={brand.id}>{brand.name}</option>
                  ))}
                </select>
              </Field>
              <Button type="submit">{ar ? "حفظ في الإشارات" : "Save to Mentions"}</Button>
            </form>
            <form action={saveScrapeListAction} className="space-y-2">
              <input type="hidden" name="runId" value={run.id} />
              <Field label={ar ? "حفظ كقائمة" : "Save as list"}>
                <input name="name" required placeholder={ar ? "عملاء القاهرة" : "Cairo leads"} />
              </Field>
              <Button type="submit" variant="soft">{ar ? "حفظ كقائمة" : "Save as list"}</Button>
            </form>
          </div>
        </Card>
      ) : null}

      <Card>
        <h2 className="font-semibold">{ar ? "النتائج" : "Results"}</h2>
        {items.length === 0 ? (
          <p className="mt-2 text-sm text-muted">
            {run.status === "QUEUED" || run.status === "RUNNING"
              ? ar
                ? "التشغيل جارٍ. حدّث الصفحة بعد دقيقة."
                : "The run is in progress. Refresh in a minute."
              : ar
                ? "لا صفوف."
                : "No rows."}
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr>
                  {columns.map((column) => (
                    <th key={column} className="border-b border-line px-2 py-1 font-medium">{column}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.slice(0, 80).map((item, index) => (
                  <tr key={index} className="align-top">
                    {columns.map((column) => (
                      <td key={column} className="border-b border-line px-2 py-1 text-muted">
                        {String(item[column] ?? "").slice(0, 180)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
