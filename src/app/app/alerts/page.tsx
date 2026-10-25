import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getBrand, listBrands } from "@/lib/workspace";
import { createAlertAction } from "@/lib/actions";
import { BrandSwitcher } from "@/components/brand-switcher";
import { Button, Card, EmptyState, Field, HelpTip, PageHeader } from "@/components/ui";
import { t } from "@/lib/i18n";

export default async function AlertsPage({
  searchParams,
}: {
  searchParams: Promise<{ brand?: string }>;
}) {
  const session = await requireSession();
  const locale = session.locale === "ar" ? "ar" : "en";
  const sp = await searchParams;
  const [brands, brand] = await Promise.all([
    listBrands(session.workspaceId),
    getBrand(session.workspaceId, sp.brand),
  ]);

  if (!brand) {
    return (
      <EmptyState
        title={locale === "ar" ? "لا تنبيهات بعد" : "No alerts yet"}
        body={locale === "ar" ? "أضف علامة أولاً ثم قرر متى تريد أن نراسلك." : "Add a brand first, then choose when we should ping you."}
        action={<Link href="/app/onboarding" className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-ink">{t(locale, "newBrand")}</Link>}
      />
    );
  }

  const alerts = await prisma.alert.findMany({
    where: { projectId: brand.id },
    include: { events: { take: 5, orderBy: { firedAt: "desc" } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        <PageHeader
          title={t(locale, "alerts")}
          description={locale === "ar"
            ? "أخبرنا متى نراسلك. يمكنك أن تطلب رسالة عندما يقفز الحديث أو عندما تظهر كلمة حساسة."
            : "Tell us when to ping you. Ask for a message when conversation jumps, or when a sensitive word appears."}
          tip={locale === "ar" ? "البريد يُرسل إن كانت إعدادات البريد جاهزة. وإلا نسجّل التنبيه هنا." : "Email sends if mail is set up. Otherwise the alert still appears here."}
        />
        <BrandSwitcher brands={brands} currentId={brand.id} path="/app/alerts" label={t(locale, "brands")} />
        <Card>
          <form action={createAlertAction} className="space-y-3">
            <input type="hidden" name="projectId" value={brand.id} />
            <Field label={locale === "ar" ? "اسم التنبيه" : "Alert name"}>
              <input name="name" required defaultValue={locale === "ar" ? "ارتفاع مفاجئ" : "Sudden jump"} />
            </Field>
            <Field label={locale === "ar" ? "متى نراسلك؟" : "When should we ping you?"}>
              <select name="type" defaultValue="SPIKE">
                <option value="SPIKE">{locale === "ar" ? "عندما يقفز عدد الإشارات" : "When mention volume jumps"}</option>
                <option value="KEYWORD">{locale === "ar" ? "عندما تظهر كلمة محددة" : "When a specific word appears"}</option>
                <option value="COMPLAINT">{locale === "ar" ? "عند شكوى أو مخاطرة (نصب، قضية، استغاثة)" : "When a complaint or risk word appears"}</option>
              </select>
            </Field>
            <Field label={locale === "ar" ? "الكلمة الحساسة (اختياري)" : "Sensitive word (optional)"} hint={locale === "ar" ? "مثال: انقطاع، احتيال" : "Example: outage, refund"}>
              <input name="keyword" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={locale === "ar" ? "بعد كم إشارة؟" : "After how many mentions?"} hint={locale === "ar" ? "افتراضي 10 في ساعة" : "Default is 10 in an hour"}>
                <input name="spikeThreshold" type="number" defaultValue={10} />
              </Field>
              <Field label={locale === "ar" ? "خلال كم دقيقة؟" : "In how many minutes?"}>
                <input name="windowMinutes" type="number" defaultValue={60} />
              </Field>
            </div>
            <Field label={locale === "ar" ? "كيف نراسلك؟" : "How should we reach you?"}>
              <select name="channel" defaultValue="EMAIL">
                <option value="EMAIL">{locale === "ar" ? "البريد" : "Email"}</option>
                <option value="SLACK">Slack</option>
                <option value="BOTH">{locale === "ar" ? "كلاهما" : "Both"}</option>
              </select>
            </Field>
            <Field label={locale === "ar" ? "البريد" : "Email"}>
              <input name="emailTo" type="email" defaultValue={session.email} />
            </Field>
            <Field label={locale === "ar" ? "رابط سلاك (اختياري)" : "Slack link (optional)"}>
              <input name="slackWebhook" placeholder="https://hooks.slack.com/..." />
            </Field>
            <Button type="submit">{locale === "ar" ? "حفظ التنبيه" : "Save alert"}</Button>
          </form>
        </Card>
      </div>
      <div className="space-y-3">
        {alerts.length === 0 ? (
          <EmptyState
            title={locale === "ar" ? "لا تنبيهات محفوظة" : "No saved alerts"}
            body={locale === "ar" ? "ابدأ بتنبيه بسيط: أرسل لي بريداً إذا تجاوز الحديث 10 إشارات في ساعة." : "Start with a simple one: email me if conversation tops 10 mentions in an hour."}
          />
        ) : alerts.map((alert) => (
          <Card key={alert.id}>
            <p className="font-medium">
              {alert.name}
              <HelpTip text={alert.type === "SPIKE"
                ? (locale === "ar" ? "يُرسل عندما يرتفع عدد الإشارات فجأة." : "Sends when mention volume suddenly rises.")
                : alert.type === "COMPLAINT"
                  ? (locale === "ar" ? "يُرسل عند إشارة فيها نصب أو قضية أو استغاثة أو شكوى شديدة." : "Sends when a mention has scam, lawsuit, distress, or a serious complaint.")
                  : (locale === "ar" ? "يُرسل عندما تظهر الكلمة التي اخترتها." : "Sends when the word you chose appears.")} />
            </p>
            <p className="text-sm text-muted">
              {alert.enabled ? (locale === "ar" ? "يعمل" : "On") : (locale === "ar" ? "متوقف" : "Off")}
              {alert.emailTo ? ` · ${alert.emailTo}` : ""}
            </p>
            <ul className="mt-3 space-y-1 text-xs text-muted">
              {alert.events.length === 0
                ? <li>{locale === "ar" ? "لم يُرسل بعد." : "Has not fired yet."}</li>
                : alert.events.map((event) => (
                  <li key={event.id}>{event.firedAt.toLocaleString()} — {event.summary}</li>
                ))}
            </ul>
          </Card>
        ))}
      </div>
    </div>
  );
}
