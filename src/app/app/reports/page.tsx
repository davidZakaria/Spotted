import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { generateReportAction } from "@/lib/actions";
import { Button, Card, EmptyState, Field, PageHeader } from "@/components/ui";
import { t } from "@/lib/i18n";

export default async function ReportsPage() {
  const session = await requireSession();
  const locale = session.locale === "ar" ? "ar" : "en";
  const [projects, reports] = await Promise.all([
    prisma.project.findMany({ where: { workspaceId: session.workspaceId } }),
    prisma.report.findMany({ where: { workspaceId: session.workspaceId }, orderBy: { createdAt: "desc" } }),
  ]);
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        <PageHeader
          title={t(locale, "reports")}
          description={locale === "ar"
            ? "حمّل جدولاً أو ملخصاً جاهزاً للمشاركة مع فريقك."
            : "Download a spreadsheet or a short summary you can share with your team."}
          tip={locale === "ar" ? "CSV يفتح في إكسل. PDF صفحة واحدة للقراءة." : "CSV opens in Excel. PDF is a one-page read."}
        />
        <Card>
          <form action={generateReportAction} className="space-y-3">
            <Field label={locale === "ar" ? "العلامة" : "Brand"}>
              <select name="projectId" required>
                {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
              </select>
            </Field>
            <Field label={locale === "ar" ? "الشكل" : "Format"}>
              <select name="format">
                <option value="CSV">{locale === "ar" ? "جدول (Excel)" : "Spreadsheet (Excel)"}</option>
                <option value="PDF">{locale === "ar" ? "ملخص PDF" : "PDF summary"}</option>
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={locale === "ar" ? "من" : "From"}><input type="date" name="from" defaultValue={weekAgo} /></Field>
              <Field label={locale === "ar" ? "إلى" : "To"}><input type="date" name="to" defaultValue={today} /></Field>
            </div>
            <Button type="submit" disabled={!projects.length}>{locale === "ar" ? "إنشاء التقرير" : "Create report"}</Button>
          </form>
        </Card>
      </div>
      <div className="space-y-3">
        {reports.length === 0 ? (
          <EmptyState
            title={locale === "ar" ? "لا تقارير بعد" : "No reports yet"}
            body={locale === "ar" ? "أنشئ تقريراً للأسبوع الماضي لتجربته." : "Create a report for last week to try it."}
          />
        ) : reports.map((report) => (
          <Card key={report.id} className="flex items-center justify-between">
            <div>
              <p className="font-medium">{report.name}</p>
              <p className="text-xs text-muted">{report.from.toISOString().slice(0, 10)} → {report.to.toISOString().slice(0, 10)}</p>
            </div>
            <a href={`/api/reports/${report.id}`} className="text-sm text-accent">{locale === "ar" ? "تنزيل" : "Download"}</a>
          </Card>
        ))}
      </div>
    </div>
  );
}
