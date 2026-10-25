import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { refreshInboxAction, replyInboxAction } from "@/lib/actions";
import { Badge, Button, Card, EmptyState, PageHeader } from "@/components/ui";
import { PlatformLogo, PlatformName } from "@/components/platform-logo";
import { formatInboxSync, inboxWarningsForWorkspace, lastInboxSyncAt } from "@/lib/inbox";
import { t } from "@/lib/i18n";

function RefreshInboxButton({ locale }: { locale: "en" | "ar" }) {
  return (
    <form action={refreshInboxAction}>
      <Button type="submit">{locale === "ar" ? "تحديث الوارد" : "Refresh inbox"}</Button>
    </form>
  );
}

export default async function InboxPage() {
  const session = await requireSession();
  const locale = session.locale === "ar" ? "ar" : "en";
  const [items, accounts, warnings, lastSync] = await Promise.all([
    prisma.inboxItem.findMany({
      where: { workspaceId: session.workspaceId },
      include: { account: true },
      orderBy: { receivedAt: "desc" },
      take: 80,
    }),
    prisma.socialAccount.findMany({
      where: { workspaceId: session.workspaceId, isMock: false },
      select: { displayName: true, platform: true, externalId: true },
      orderBy: { createdAt: "asc" },
    }),
    inboxWarningsForWorkspace(session.workspaceId),
    lastInboxSyncAt(session.workspaceId),
  ]);

  const feedNames = accounts.map((account) => account.displayName).filter(Boolean);
  const lastSyncLabel = formatInboxSync(lastSync, locale);
  const description =
    locale === "ar"
      ? "تعليقات ورسائل ومراجعات من الحسابات التي ربطتها — في قائمة واحدة."
      : "Comments, messages, and reviews from accounts you connected — in one list.";
  const feedsLine = feedNames.length
    ? locale === "ar"
      ? `يغذّيه: ${feedNames.join("، ")}. نحدّثه كل 5 دقائق.`
      : `This list is fed by ${feedNames.join(", ")}. We refresh it every 5 minutes.`
    : locale === "ar"
      ? "اربط صفحة فيسبوك أو موقع جوجل بزنس أو حساباً آخر يسمح بالتعليقات أو الرسائل. نحدّث الوارد كل 5 دقائق."
      : "Connect a Facebook Page, Google Business location, or another account that allows comments or messages. We refresh the inbox every 5 minutes.";
  const lastSyncLine =
    locale === "ar" ? `آخر مزامنة: ${lastSyncLabel}` : `Last synced: ${lastSyncLabel}`;

  return (
    <div className="space-y-5">
      <PageHeader
        title={t(locale, "inbox")}
        description={description}
        tip={locale === "ar" ? "الرد يُرسل إلى المنصة إن كان الحساب مربوطاً حقاً." : "A reply is sent to the real platform when the account is truly connected."}
        actions={<RefreshInboxButton locale={locale} />}
      />
      <p className="text-sm text-muted">
        {feedsLine} {lastSyncLine}
      </p>
      {warnings.length ? (
        <Card className="border-warn/40">
          <p className="text-sm font-medium text-warn">{locale === "ar" ? "ملاحظات المنصات" : "Platform notes"}</p>
          <ul className="mt-2 space-y-1 text-sm text-muted">
            {warnings.map((warning) => (
              <li key={warning.id}>{warning.message}</li>
            ))}
          </ul>
        </Card>
      ) : null}
      {!items.length ? (
        <EmptyState
          title={locale === "ar" ? "الوارد فارغ" : "Inbox is empty"}
          body={
            locale === "ar"
              ? `${feedsLine} ${lastSyncLine} إن بقي فارغاً بعد التحديث فقد تحتاج الصفحة إلى إذن لقراءة التعليقات أو الرسائل.`
              : `${feedsLine} ${lastSyncLine} If this stays empty after a refresh, the Page may need permission to read comments or Messenger.`
          }
          action={<RefreshInboxButton locale={locale} />}
        />
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <Card key={item.id}>
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
                <span className="inline-flex items-center gap-2">
                  <PlatformLogo id={item.platform} size={20} />
                  <PlatformName id={item.platform} locale={locale} />
                  <span>· {item.authorName}</span>
                  <span>· {item.receivedAt.toLocaleString(locale === "ar" ? "ar" : "en")}</span>
                </span>
                <Badge tone={item.status === "REPLIED" ? "good" : "muted"}>
                  {item.status === "REPLIED" ? (locale === "ar" ? "تم الرد" : "Replied") : locale === "ar" ? "جديد" : "New"}
                </Badge>
              </div>
              <p dir="auto" lang={item.language ?? undefined} className="rtl-content mt-2 text-sm">
                {item.content}
              </p>
              {item.status !== "REPLIED" ? (
                <form action={replyInboxAction} className="mt-3 flex gap-2">
                  <input type="hidden" name="id" value={item.id} />
                  <input name="message" placeholder={locale === "ar" ? "اكتب رداً…" : "Write a reply…"} className="flex-1" />
                  <button className="rounded-xl bg-accent px-3 text-sm font-semibold text-accent-ink">
                    {locale === "ar" ? "رد" : "Reply"}
                  </button>
                </form>
              ) : null}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
