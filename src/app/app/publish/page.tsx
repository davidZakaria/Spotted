import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { schedulePostAction } from "@/lib/actions";
import { Badge, Button, Card, EmptyState, Field, PageHeader } from "@/components/ui";
import { PlatformLogo, PlatformName } from "@/components/platform-logo";
import { t } from "@/lib/i18n";

function monthCells(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  const pad = start.getDay();
  return [...Array(pad).fill(null), ...Array.from({ length: end.getDate() }, (_, i) => i + 1)] as (number | null)[];
}

export default async function PublishPage() {
  const session = await requireSession();
  const locale = session.locale === "ar" ? "ar" : "en";
  const [accounts, posts] = await Promise.all([
    prisma.socialAccount.findMany({ where: { workspaceId: session.workspaceId } }),
    prisma.scheduledPost.findMany({ where: { workspaceId: session.workspaceId }, orderBy: { scheduledAt: "asc" } }),
  ]);
  const now = new Date();
  const cells = monthCells(now);
  const byDay = new Map<number, number>();
  for (const post of posts) {
    if (post.scheduledAt.getMonth() === now.getMonth()) {
      const day = post.scheduledAt.getDate();
      byDay.set(day, (byDay.get(day) ?? 0) + 1);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="space-y-5">
        <PageHeader
          title={t(locale, "publish")}
          description={locale === "ar"
            ? "اكتب منشوراً واختر وقتاً. إن لم تربط حساباً بعد نستخدم حساباً تجريبياً حتى ترى كيف يعمل التقويم."
            : "Write a post and pick a time. If you have not connected an account yet, we use a practice account so you can still see the calendar."}
          tip={locale === "ar" ? "المنشور التجريبي لا يظهر للعامة." : "Practice posts stay inside Spotted. They are not sent to the real network."}
        />
        <Card>
          <h2 className="mb-3 font-semibold">{now.toLocaleString(locale === "ar" ? "ar" : "en", { month: "long", year: "numeric" })}</h2>
          <p className="mb-3 text-sm text-muted">{locale === "ar" ? "الأيام التي فيها نقطة لديها منشور مجدول." : "Days with a mark already have something scheduled."}</p>
          <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted">
            {(locale === "ar" ? ["ح", "ن", "ث", "ر", "خ", "ج", "س"] : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]).map((day) => <div key={day}>{day}</div>)}
            {cells.map((day, i) => (
              <div key={i} className="min-h-14 rounded-lg border border-line/70 p-1 text-ink">
                {day ? (
                  <>
                    <div>{day}</div>
                    {byDay.get(day) ? <div className="mt-1 rounded bg-accent/20 text-[10px] text-accent">{byDay.get(day)}</div> : null}
                  </>
                ) : null}
              </div>
            ))}
          </div>
        </Card>
        {posts.length === 0 ? (
          <EmptyState
            title={locale === "ar" ? "لا منشورات مجدولة" : "Nothing scheduled"}
            body={locale === "ar" ? "اكتب شيئاً على اليمين واختر وقتاً." : "Write something on the right and pick a time."}
          />
        ) : posts.map((post) => (
          <Card key={post.id} className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm">{post.content}</p>
              <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                {post.scheduledAt.toLocaleString(locale === "ar" ? "ar" : "en")}
                {post.platforms.map((platform) => (
                  <span key={platform} className="inline-flex items-center gap-1">
                    <PlatformLogo id={platform} size={16} />
                    <PlatformName id={platform} locale={locale} />
                  </span>
                ))}
              </p>
            </div>
            <Badge tone={post.status === "FAILED" ? "bad" : post.status === "PUBLISHED" ? "good" : "accent"}>
              {post.status === "SCHEDULED" ? (locale === "ar" ? "مجدول" : "Scheduled") : post.status === "PUBLISHED" ? (locale === "ar" ? "نُشر" : "Published") : (locale === "ar" ? "فشل" : "Failed")}
            </Badge>
          </Card>
        ))}
      </div>
      <Card>
        <h2 className="mb-3 font-semibold">{locale === "ar" ? "جدول منشوراً" : "Schedule a post"}</h2>
        <form action={schedulePostAction} className="space-y-3">
          <Field label={locale === "ar" ? "الحساب" : "Account"} hint={locale === "ar" ? "الحساب التجريبي آمن للتدريب." : "The practice account is safe for trying this out."}>
            <select name="accountId" defaultValue="">
              <option value="">{locale === "ar" ? "حساب تجريبي على إكس" : "Practice X account"}</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.displayName} · {account.isMock ? (locale === "ar" ? "تجريبي" : "practice") : account.platform}
                </option>
              ))}
            </select>
          </Field>
          <Field label={locale === "ar" ? "النص" : "What do you want to say?"}>
            <textarea name="content" required rows={5} placeholder={locale === "ar" ? "شكراً لكل من جرب المنتج هذا الأسبوع." : "Thanks to everyone who tried the product this week."} />
          </Field>
          <Field label={locale === "ar" ? "متى؟" : "When?"}>
            <input name="scheduledAt" type="datetime-local" />
          </Field>
          <Button type="submit">{locale === "ar" ? "أضف إلى التقويم" : "Add to calendar"}</Button>
        </form>
      </Card>
    </div>
  );
}
