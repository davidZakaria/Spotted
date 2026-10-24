import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { Card, PageHeader } from "@/components/ui";
import { t } from "@/lib/i18n";

export default async function HelpPage() {
  const session = await requireSession();
  const locale = session.locale === "ar" ? "ar" : "en";
  const steps = locale === "ar"
    ? [
        ["1. أخبرنا عن علامتك", "سمِّ الشركة أو المنتج واكتب الكلمات التي تريد مراقبتها — مثل اسم العلامة أو شكوى شائعة."],
        ["2. نحن نبحث", "ننظر في المواقع العامة الجاهزة الآن، ونضيف فيسبوك وإنستغرام وغيرهما بعد أن تربطها."],
        ["3. تقرأ المزاج", "كل إشارة تظهر مع لون: أخضر إيجابي، رمادي محايد، أحمر سلبي. الرسوم تلخص الأسبوع."],
        ["4. ترد وتنشر", "الوارد يجمع الرسائل. النشر يضع منشوراً على التقويم. التنبيهات تراسلك عند ارتفاع مفاجئ."],
      ]
    : [
        ["1. Tell us about your brand", "Name the company or product and the words you want watched — your brand name, a product, or a common complaint."],
        ["2. We look around the web", "Public sites start immediately. Facebook, Instagram, and others join after you connect them."],
        ["3. You read the mood", "Each mention has a color: green for positive, gray for mixed, red for negative. Charts sum up the week."],
        ["4. Reply and publish", "Inbox gathers messages. Publish puts a post on the calendar. Alerts email you when conversation jumps."],
      ];

  const faq = locale === "ar"
    ? [
        ["ما الإشارة؟", "أي منشور عام يحتوي على كلماتك."],
        ["هل نقرأ الرسائل الخاصة؟", "فقط بعد أن تربط حساباً يسمح بذلك، مثل صفحة فيسبوك."],
        ["لماذا بعض المنصات «تحتاج ربطاً»؟", "تلك المواقع لا تسمح بالبحث العام. تحتاج أن تسمح لنا بالدخول بحسابك."],
        ["هل البيانات دقيقة 100%؟", "لا. نجمع ما تسمح به كل منصة ونقدّر المزاج من الكلمات."],
      ]
    : [
        ["What is a mention?", "Any public post that includes your watch words."],
        ["Do you read private messages?", "Only after you connect an account that allows it, such as a Facebook Page."],
        ["Why do some platforms say they need connecting?", "Those sites do not allow public search. You have to let us in with your login."],
        ["Is this 100% accurate?", "No. We collect what each site allows and estimate mood from the words."],
      ];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title={t(locale, "howItWorks")}
        description={locale === "ar"
          ? "سبوتد يراقب الحديث عن علامتك ويجعل الخطوة التالية واضحة."
          : "Spotted watches conversation about your brand and makes the next step obvious."}
      />
      <div className="grid gap-4">
        {steps.map(([title, body]) => (
          <Card key={title}>
            <h2 className="font-semibold">{title}</h2>
            <p className="mt-2 text-sm text-muted">{body}</p>
          </Card>
        ))}
      </div>
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">{locale === "ar" ? "أسئلة قصيرة" : "Short answers"}</h2>
        {faq.map(([q, a]) => (
          <Card key={q}>
            <p className="font-medium">{q}</p>
            <p className="mt-1 text-sm text-muted">{a}</p>
          </Card>
        ))}
      </div>
      <p className="text-sm">
        <Link href="/app/onboarding" className="text-accent">{locale === "ar" ? "ابدأ بإعداد علامة" : "Start by setting up a brand"}</Link>
        {" · "}
        <Link href="/app/settings/platforms" className="text-accent">{t(locale, "platforms")}</Link>
      </p>
    </div>
  );
}
