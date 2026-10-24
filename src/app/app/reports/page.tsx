import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { generateReportAction } from "@/lib/actions";
import { Button, Card, Field } from "@/components/ui";

export default async function ReportsPage() {
  const session = await requireSession();
  const [projects, reports] = await Promise.all([
    prisma.project.findMany({ where: { workspaceId: session.workspaceId } }),
    prisma.report.findMany({ where: { workspaceId: session.workspaceId }, orderBy: { createdAt: "desc" } }),
  ]);
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div>
        <h1 className="text-2xl font-semibold">Reports</h1>
        <p className="mb-4 text-sm text-muted">Export mentions as CSV or a PDF summary with volume, sentiment, and topics.</p>
        <Card>
          <form action={generateReportAction} className="space-y-3">
            <Field label="Project">
              <select name="projectId" required>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Field>
            <Field label="Format">
              <select name="format">
                <option value="CSV">CSV</option>
                <option value="PDF">PDF</option>
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="From"><input type="date" name="from" defaultValue={weekAgo} /></Field>
              <Field label="To"><input type="date" name="to" defaultValue={today} /></Field>
            </div>
            <Button type="submit" disabled={!projects.length}>Generate</Button>
          </form>
        </Card>
      </div>
      <div className="space-y-3">
        {reports.map((r) => (
          <Card key={r.id} className="flex items-center justify-between">
            <div>
              <p className="font-medium">{r.name}</p>
              <p className="text-xs text-muted">{r.format} · {r.from.toISOString().slice(0, 10)} → {r.to.toISOString().slice(0, 10)}</p>
            </div>
            <a href={`/api/reports/${r.id}`} className="text-sm text-accent">Download</a>
          </Card>
        ))}
      </div>
    </div>
  );
}
