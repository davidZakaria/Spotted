import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { replyInboxAction } from "@/lib/actions";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { PlatformLogo, PlatformName } from "@/components/platform-logo";
import { t } from "@/lib/i18n";

export default async function InboxPage() {
  const session = await requireSession();
  const locale = session.locale === "ar" ? "ar" : "en";
  const items = await prisma.inboxItem.findMany({
    where: { workspaceId: session.workspaceId },
    include: { account: true },
    orderBy: { receivedAt: "desc" },
    take: 80,
  });

  if (!items.length) {
    return (
      <EmptyState
        title={locale === "ar" ? "الوارد فارغ" : "Inbox is empty"}
        body={locale === "ar"
          ? "اربط صفحة أو حساباً في المنصات المتصلة لتظهر التعليقات والرسائل هنا."
          : "Connect a page or account in Connected platforms and comments or messages will land here."}
      />
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title={t(locale, "inbox")}
        description={locale === "ar"
          ? "تعليقات ورسائل ومراجعات من الحسابات التي ربطتها — في قائمة واحدة."
          : "Comments, messages, and reviews from accounts you connected — in one list."}
        tip={locale === "ar" ? "الرد يُرسل إلى المنصة إن كان الحساب مربوطاً حقاً." : "A reply is sent to the real platform when the account is truly connected."}
      />
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
                {item.status === "REPLIED" ? (locale === "ar" ? "تم الرد" : "Replied") : (locale === "ar" ? "جديد" : "New")}
              </Badge>
            </div>
            <p dir="auto" lang={item.language ?? undefined} className="rtl-content mt-2 text-sm">{item.content}</p>
            {item.status !== "REPLIED" ? (
              <form action={replyInboxAction} className="mt-3 flex gap-2">
                <input type="hidden" name="id" value={item.id} />
                <input name="message" placeholder={locale === "ar" ? "اكتب رداً…" : "Write a reply…"} className="flex-1" />
                <button className="rounded-xl bg-accent px-3 text-sm font-semibold text-accent-ink">{locale === "ar" ? "رد" : "Reply"}</button>
              </form>
            ) : null}
          </Card>
        ))}
      </div>
    </div>
  );
}
