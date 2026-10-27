import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { listBrands } from "@/lib/workspace";
import { saveApifyLimitAction, startScrapeAction } from "@/lib/actions";
import { scrapeBudget } from "@/lib/jobs/scraper";
import { hasApifyToken, missingTokenMessage } from "@/lib/scrape/apify";
import { SCRAPE_TOOLS, scrapeTool } from "@/lib/scrape/tools";
import { Button, Card, EmptyState, Field, PageHeader } from "@/components/ui";

export default async function ScraperPage({
  searchParams,
}: {
  searchParams: Promise<{ tool?: string }>;
}) {
  const session = await requireSession();
  const locale = session.locale === "ar" ? "ar" : "en";
  const ar = locale === "ar";
  const sp = await searchParams;
  const tool = scrapeTool(sp.tool ?? "") ?? SCRAPE_TOOLS[0];
  const [budget, brands, runs, lists] = await Promise.all([
    scrapeBudget(session.workspaceId),
    listBrands(session.workspaceId),
    prisma.scrapeRun.findMany({
      where: { workspaceId: session.workspaceId },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.scrapeList.findMany({
      where: { workspaceId: session.workspaceId },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader
        title={ar ? "المكشط" : "Scraper"}
        description={
          ar
            ? "أدوات جاهزة لنسخ الصفحات العامة والقوائم. أنت مسؤول عن اتباع شروط كل موقع. لا نحفظ كوكيز أو كلمات مرور."
            : "Ready-made tools that copy public pages and lists. You are responsible for following each site’s terms. We never store cookies or logins."
        }
      />
      {!hasApifyToken() ? (
        <Card className="border-warn/40">
          <p className="font-medium text-warn">{ar ? "المكشط غير مفعّل بعد" : "Scraper is not turned on yet"}</p>
          <p className="mt-1 text-sm text-muted">{missingTokenMessage(locale)}</p>
        </Card>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <p className="text-xs text-muted">{ar ? "صرف هذا الشهر" : "Spent this month"}</p>
          <p className="text-2xl font-semibold">
            ${budget.used.toFixed(2)} <span className="text-sm font-normal text-muted">/ ${budget.limit}</span>
          </p>
          <p className="mt-1 text-xs text-muted">
            {ar
              ? `المتبقي تقريباً $${budget.remaining.toFixed(2)}${budget.username ? ` · حساب Apify: ${budget.username}` : ""}`
              : `About $${budget.remaining.toFixed(2)} left${budget.username ? ` · Apify: ${budget.username}` : ""}`}
          </p>
          <form action={saveApifyLimitAction} className="mt-3 flex items-end gap-2">
            <Field label={ar ? "الحد الشهري بالدولار" : "Monthly cap in $"}>
              <input name="limit" type="number" min={1} max={5000} defaultValue={budget.limit} />
            </Field>
            <Button type="submit" variant="soft">{ar ? "حفظ" : "Save"}</Button>
          </form>
        </Card>
        <Card className="lg:col-span-2">
          <h2 className="font-semibold">{ar ? "اختر أداة" : "Pick a tool"}</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {SCRAPE_TOOLS.map((item) => (
              <Link
                key={item.id}
                href={`/app/scraper?tool=${item.id}`}
                className={`rounded-xl border px-3 py-2 text-sm ${item.id === tool.id ? "border-accent bg-accent/10" : "border-line hover:bg-bg-soft"}`}
              >
                <span className="font-medium">{ar ? item.nameAr : item.name}</span>
                <span className="mt-0.5 block text-xs text-muted">{ar ? item.helperAr : item.helper}</span>
              </Link>
            ))}
          </div>
        </Card>
      </div>

      <Card>
        <h2 className="font-semibold">{ar ? tool.nameAr : tool.name}</h2>
        <p className="mt-1 text-sm text-muted">{ar ? tool.helperAr : tool.helper}</p>
        <p className="mt-2 text-sm">
          {ar ? `التكلفة التقديرية قبل التشغيل: $${tool.estimateUsd.toFixed(2)}` : `Estimated cost before you run: $${tool.estimateUsd.toFixed(2)}`}
        </p>
        <form action={startScrapeAction} className="mt-4 space-y-3">
          <input type="hidden" name="toolId" value={tool.id} />
          {tool.fields.map((field) => (
            <Field key={field.name} label={ar ? field.labelAr : field.label} hint={ar ? field.hintAr : field.hint}>
              {field.type === "textarea" ? (
                <textarea name={field.name} rows={4} required={field.required} placeholder={field.placeholder} />
              ) : (
                <input
                  name={field.name}
                  type={field.type === "number" ? "number" : "text"}
                  required={field.required}
                  placeholder={field.placeholder}
                  min={field.type === "number" ? 1 : undefined}
                />
              )}
            </Field>
          ))}
          <Field label={ar ? "اسم يظهر في السجل (اختياري)" : "Name in history (optional)"}>
            <input name="title" placeholder={ar ? tool.nameAr : tool.name} />
          </Field>
          <Field label={ar ? "احفظ النتائج في علامة" : "Save results into a brand later"}>
            <select name="projectId" defaultValue="">
              <option value="">{ar ? "اختَر لاحقاً" : "Choose later"}</option>
              {brands.map((brand) => (
                <option key={brand.id} value={brand.id}>{brand.name}</option>
              ))}
            </select>
          </Field>
          <Field label={ar ? "أعد التشغيل كل كم ساعة؟ (0 = مرة واحدة)" : "Re-run every how many hours? (0 = once)"}>
            <input name="scheduleHours" type="number" min={0} max={168} defaultValue={0} />
          </Field>
          <Button type="submit" disabled={!budget.hasToken}>
            {ar ? `تشغيل · حوالي $${tool.estimateUsd.toFixed(2)}` : `Run · about $${tool.estimateUsd.toFixed(2)}`}
          </Button>
        </form>
      </Card>

      <Card>
        <h2 className="font-semibold">{ar ? "سجل التشغيل" : "Run history"}</h2>
        {runs.length === 0 ? (
          <p className="mt-2 text-sm text-muted">{ar ? "لا تشغيل بعد." : "No runs yet."}</p>
        ) : (
          <ul className="mt-3 divide-y divide-line text-sm">
            {runs.map((run) => (
              <li key={run.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <Link href={`/app/scraper/${run.id}`} className="font-medium hover:text-accent">
                  {run.title}
                </Link>
                <span className="text-xs text-muted">
                  {run.status} · {run.itemCount} · ${run.estimatedCostUsd.toFixed(2)}
                  {run.scheduleHours ? (ar ? ` · كل ${run.scheduleHours}س` : ` · every ${run.scheduleHours}h`) : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <h2 className="font-semibold">{ar ? "القوائم المحفوظة" : "Saved lists"}</h2>
        {lists.length === 0 ? (
          <EmptyState
            title={ar ? "لا قوائم بعد" : "No lists yet"}
            body={ar ? "بعد نجاح التشغيل اختر «حفظ كقائمة»." : "After a run succeeds, choose Save as list."}
          />
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {lists.map((list) => (
              <li key={list.id} className="flex justify-between gap-2">
                <span>{list.name}</span>
                <span className="text-muted">{Array.isArray(list.items) ? list.items.length : 0}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
