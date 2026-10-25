import { requireSession } from "@/lib/auth";
import { connectorStatus } from "@/lib/connectors/registry";
import { usageSummary } from "@/lib/connectors/usage";
import { serpUsageSummary } from "@/lib/listen/serpapi";
import { instagramHashtagStatus } from "@/lib/connectors/quotas";
import { prisma } from "@/lib/db";
import { disconnectAccountAction, updateBudgetAction } from "@/lib/actions";
import { Badge, Button, Card, Field, PageHeader } from "@/components/ui";
import { ConnectButton } from "@/components/connect-button";
import { ConnectHelp } from "@/components/connect-help";
import { PlatformLogo } from "@/components/platform-logo";
import { PLATFORMS } from "@/lib/platforms";
import { formatUsd } from "@/lib/utils";
import { t } from "@/lib/i18n";
import { oauthErrorCopy } from "@/lib/oauth-errors";
import {
  describeConnection,
  hasAppKeys,
  hasBlueskySession,
  hasGoogleOAuth,
  hasYoutubeApiKey,
  oauthPathFor,
} from "@/lib/platform-status";

export default async function PlatformsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; connected?: string; pages?: string }>;
}) {
  const session = await requireSession();
  const locale = session.locale === "ar" ? "ar" : "en";
  const { error, connected, pages } = await searchParams;
  const sources = connectorStatus();
  const xUsage = await usageSummary(session.workspaceId, "X");
  const serp = await serpUsageSummary(session.workspaceId);
  const igAccount = await prisma.socialAccount.findFirst({
    where: { workspaceId: session.workspaceId, platform: "INSTAGRAM" },
  });
  const igQuota = await instagramHashtagStatus(igAccount?.id);
  const accounts = await prisma.socialAccount.findMany({
    where: { workspaceId: session.workspaceId },
    select: { id: true, platform: true, displayName: true, handle: true, isMock: true, status: true },
  });
  const errorText = oauthErrorCopy(error, locale);
  const pageCount = Number(pages ?? 0);
  const successText = connected
    ? locale === "ar"
      ? pageCount > 0
        ? `تم ربط ${pageCount} صفحة. سنجمع المنشورات والتعليقات والإشارات.`
        : "تم الربط. سنبدأ بجمع الإشارات."
      : pageCount > 0
        ? `Connected ${pageCount} Facebook Page${pageCount === 1 ? "" : "s"}. We will collect posts, comments, and mentions.`
        : "Connected. We will start collecting mentions."
    : null;

  const cards = PLATFORMS.filter((platform) => platform.id !== "GOOGLE_TRENDS").map((platform) => {
    const status = sources.find((s) => s.id === platform.id);
    const view = describeConnection({
      platform: platform.id,
      keyless: Boolean(status?.keyless),
      hasAppKeys: hasAppKeys(platform.id),
      accounts,
      youtubeSearchWorks: hasYoutubeApiKey(),
      youtubeOAuthReady: hasGoogleOAuth(),
    });
    return { platform, view, connectHref: view.showConnect ? oauthPathFor(platform.id) : undefined };
  });
  const working = cards.filter((card) => card.view.kind === "working");
  const connectable = cards.filter((card) => card.view.kind !== "working");

  return (
    <div className="space-y-6">
      <PageHeader
        title={t(locale, "platforms")}
        description={locale === "ar"
          ? "بعض المواقع نبحث فيها فوراً. أخرى تحتاج أن تضغط «ربط» وتسمح لنا بالدخول."
          : "Some sites we can search right away. Others need you to tap Connect and allow access."}
        tip={locale === "ar" ? "اضغط «كيف أربط؟» لأي منصة لخطوات بسيطة." : "Tap How to connect on any platform for simple steps."}
      />

      {errorText ? <p className="rounded-xl bg-bad/10 px-4 py-3 text-sm text-bad">{errorText}</p> : null}
      {successText ? <p className="rounded-xl bg-good/10 px-4 py-3 text-sm text-good">{successText}</p> : null}

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
          <h2 className="font-semibold">{locale === "ar" ? "حد SerpAPI (بحث جوجل)" : "SerpAPI (Google web & News)"}</h2>
          <p className="mt-1 text-sm text-muted">
            {serp.hasKey
              ? locale === "ar"
                ? `تبقّى ${serp.remaining} من ${serp.limit} هذا الشهر. نستخدمه في «ابحث في كل مكان» ومرتين لكل كلمة يومياً.`
                : `${serp.remaining} of ${serp.limit} searches left this month (SERPAPI_MONTHLY_LIMIT). Used for Search everywhere and two scheduled refreshes per watched word per day.`
              : locale === "ar"
                ? "أضف SERPAPI_API_KEY لتوسيع بحث الويب والأخبار."
                : "Add SERPAPI_API_KEY to include Google web and Google News results."}
          </p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-bg-soft">
            <div className="h-full bg-accent" style={{ width: `${serp.limit ? (serp.used / serp.limit) * 100 : 0}%` }} />
          </div>
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

      {accounts.some((account) => !account.isMock) ? (
        <Card>
          <h2 className="font-semibold">{locale === "ar" ? "حسابات مربوطة" : "Connected accounts"}</h2>
          <ul className="mt-3 space-y-2">
            {accounts.filter((account) => !account.isMock).map((account) => (
              <li key={account.id} className="flex items-center justify-between gap-3 text-sm">
                <span>{account.displayName} · {account.platform}</span>
                <form action={disconnectAccountAction}>
                  <input type="hidden" name="accountId" value={account.id} />
                  <Button type="submit" variant="soft">{locale === "ar" ? "قطع الربط" : "Disconnect"}</Button>
                </form>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{locale === "ar" ? "يعمل الآن" : "Working now"}</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {working.map(({ platform, view }) => (
            <Card key={platform.id} className="flex items-start gap-3">
              <PlatformLogo id={platform.id} size={36} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">{locale === "ar" ? platform.nameAr : platform.name}</p>
                  <Badge tone={view.tone}>{locale === "ar" ? view.badgeAr : view.badge}</Badge>
                </div>
                <p className="mt-1 text-sm text-muted">{locale === "ar" ? platform.blurbAr : platform.blurb}</p>
                <SearchBlockNote platformId={platform.id} locale={locale} />
                <div className="mt-3"><ConnectHelp platform={platform} locale={locale} /></div>
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{locale === "ar" ? "اربط حساباً" : "Connect an account"}</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {connectable.map(({ platform, view, connectHref }) => (
            <Card key={platform.id} className="flex items-start gap-3">
              <PlatformLogo id={platform.id} size={36} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">{locale === "ar" ? platform.nameAr : platform.name}</p>
                  <Badge tone={view.tone}>{locale === "ar" ? view.badgeAr : view.badge}</Badge>
                </div>
                <p className="mt-1 text-sm text-muted">{locale === "ar" ? platform.blurbAr : platform.blurb}</p>
                <p className="mt-1 text-xs text-muted">{locale === "ar" ? platform.connectHintAr : platform.connectHint}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {connectHref ? (
                    <ConnectButton href={connectHref} label={locale === "ar" ? "ربط" : "Connect"} />
                  ) : null}
                  <ConnectHelp platform={platform} locale={locale} connectHref={connectHref} />
                </div>
              </div>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}

function SearchBlockNote({ platformId, locale }: { platformId: string; locale: string }) {
  const ar = locale === "ar";
  if (platformId === "REDDIT") {
    return (
      <p className="mt-1 text-xs text-muted">
        {ar
          ? "يُعثر عليها عبر بحث جوجل. الوصول المباشر لريديت يحتاج موافقة ريديت."
          : "Found through Google search. Direct Reddit access needs Reddit's approval."}
      </p>
    );
  }
  if (platformId === "BLUESKY" && !hasBlueskySession()) {
    return (
      <p className="mt-1 text-xs text-muted">
        {ar
          ? "إن بقي بحث بلوسكاي فارغاً من هذا الخادم، أضف BLUESKY_HANDLE و BLUESKY_APP_PASSWORD."
          : "If Bluesky search stays empty from this server, add BLUESKY_HANDLE and BLUESKY_APP_PASSWORD."}
      </p>
    );
  }
  return null;
}
