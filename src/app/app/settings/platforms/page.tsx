import { requireSession } from "@/lib/auth";
import { connectorStatus } from "@/lib/connectors/registry";
import { usageSummary } from "@/lib/connectors/usage";
import { instagramHashtagStatus } from "@/lib/connectors/quotas";
import { prisma } from "@/lib/db";
import { updateBudgetAction } from "@/lib/actions";
import { Badge, Button, Card, Field, PageHeader } from "@/components/ui";
import { ConnectHelp } from "@/components/connect-help";
import { PlatformLogo } from "@/components/platform-logo";
import { PLATFORMS } from "@/lib/platforms";
import { formatUsd } from "@/lib/utils";
import { t } from "@/lib/i18n";
import type { Source } from "@prisma/client";

const OAUTH: Partial<Record<Source, string>> = {
  FACEBOOK: "/api/oauth/meta",
  INSTAGRAM: "/api/oauth/meta",
  THREADS: "/api/oauth/meta",
  X: "/api/oauth/x",
  LINKEDIN: "/api/oauth/linkedin",
  YOUTUBE: "/api/oauth/google",
  GOOGLE_BUSINESS: "/api/oauth/google",
};

export default async function PlatformsPage() {
  const session = await requireSession();
  const locale = session.locale === "ar" ? "ar" : "en";
  const sources = connectorStatus();
  const xUsage = await usageSummary(session.workspaceId, "X");
  const igAccount = await prisma.socialAccount.findFirst({
    where: { workspaceId: session.workspaceId, platform: "INSTAGRAM" },
  });
  const igQuota = await instagramHashtagStatus(igAccount?.id);
  const accounts = await prisma.socialAccount.findMany({
    where: { workspaceId: session.workspaceId },
  });

  const ready = PLATFORMS.filter((p) => p.readyNow && p.id !== "GOOGLE_TRENDS");
  const later = PLATFORMS.filter((p) => !p.readyNow);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t(locale, "platforms")}
        description={locale === "ar"
          ? "بعض المواقع نبحث فيها فوراً. أخرى تحتاج أن تضغط «ربط» وتسمح لنا بالدخول."
          : "Some sites we can search right away. Others need you to tap Connect and allow access."}
        tip={locale === "ar" ? "اضغط «كيف أربط؟» لأي منصة لخطوات بسيطة." : "Tap How to connect on any platform for simple steps."}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="font-semibold">{locale === "ar" ? "حد إنفاق إكس (تويتر)" : "X (Twitter) spending limit"}</h2>
          <p className="mt-1 text-sm text-muted">
            {locale === "ar"
              ? `استخدمنا ${xUsage.dailyCalls} بحثاً اليوم و ${xUsage.monthlyCalls} هذا الشهر · تقدير ${formatUsd(xUsage.monthlySpendUsd, locale)}. نتوقف تلقائياً عند حدك.`
              : `Used ${xUsage.dailyCalls} searches today and ${xUsage.monthlyCalls} this month · about ${formatUsd(xUsage.monthlySpendUsd, locale)}. We stop automatically at your limit.`}
          </p>
          <form action={updateBudgetAction} className="mt-3 grid grid-cols-3 gap-2">
            <Field label={locale === "ar" ? "يومياً" : "Per day"}><input name="dailyCallLimit" type="number" defaultValue={xUsage.budget?.dailyCallLimit ?? 50} /></Field>
            <Field label={locale === "ar" ? "شهرياً" : "Per month"}><input name="monthlyCallLimit" type="number" defaultValue={xUsage.budget?.monthlyCallLimit ?? 500} /></Field>
            <Field label={locale === "ar" ? "حد $" : "Max $"}><input name="monthlySpendLimitUsd" type="number" step="0.01" defaultValue={xUsage.budget?.monthlySpendLimitUsd ?? 25} /></Field>
            <div className="col-span-3"><Button type="submit">{t(locale, "save")}</Button></div>
          </form>
        </Card>
        <Card>
          <h2 className="font-semibold">{locale === "ar" ? "حصة هاشتاج إنستغرام" : "Instagram hashtag allowance"}</h2>
          <p className="mt-1 text-sm text-muted">
            {locale === "ar"
              ? `إنستغرام يسمح بـ 30 هاشتاجاً جديداً كل 7 أيام. استخدمنا ${igQuota.used} وبقي ${igQuota.remaining}.`
              : `Instagram allows 30 new hashtags every 7 days. Used ${igQuota.used}, ${igQuota.remaining} left.`}
          </p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-bg-soft">
            <div className="h-full bg-accent" style={{ width: `${(igQuota.used / 30) * 100}%` }} />
          </div>
        </Card>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{locale === "ar" ? "يعمل الآن — بلا تسجيل" : "Works right now — no login"}</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {ready.map((platform) => (
            <Card key={platform.id} className="flex items-start gap-3">
              <PlatformLogo id={platform.id} size={36} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">{locale === "ar" ? platform.nameAr : platform.name}</p>
                  <Badge tone="good">{locale === "ar" ? "جاهز" : "Ready"}</Badge>
                </div>
                <p className="mt-1 text-sm text-muted">{locale === "ar" ? platform.blurbAr : platform.blurb}</p>
                <div className="mt-3"><ConnectHelp platform={platform} locale={locale} /></div>
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{locale === "ar" ? "يحتاج ربط حساب" : "Needs a connected account"}</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {later.map((platform) => {
            const status = sources.find((s) => s.id === platform.id);
            const connected = accounts.some((account) => account.platform === platform.id && !account.isMock);
            const live = status?.configured || connected;
            return (
              <Card key={platform.id} className="flex items-start gap-3">
                <PlatformLogo id={platform.id} size={36} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold">{locale === "ar" ? platform.nameAr : platform.name}</p>
                    <Badge tone={live ? "good" : "warn"}>{live ? (locale === "ar" ? "متصل" : "Connected") : (locale === "ar" ? "غير متصل" : "Not connected")}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted">{locale === "ar" ? platform.blurbAr : platform.blurb}</p>
                  <p className="mt-1 text-xs text-muted">{locale === "ar" ? platform.connectHintAr : platform.connectHint}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {OAUTH[platform.id] ? (
                      <a href={OAUTH[platform.id]} className="rounded-xl bg-accent px-3 py-1.5 text-xs font-semibold text-accent-ink">
                        {locale === "ar" ? "ربط" : "Connect"}
                      </a>
                    ) : null}
                    <ConnectHelp platform={platform} locale={locale} connectHref={OAUTH[platform.id]} />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}
