import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getBrand, listBrands } from "@/lib/workspace";
import { BrandSwitcher } from "@/components/brand-switcher";
import { MentionCard } from "@/components/mention-card";
import { EmptyState, PageHeader } from "@/components/ui";
import { t } from "@/lib/i18n";
import { listenNowAction } from "@/lib/actions";
import { PLATFORMS } from "@/lib/platforms";

export default async function MentionsPage({
  searchParams,
}: {
  searchParams: Promise<{ brand?: string; q?: string; source?: string; sentiment?: string }>;
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
        title={locale === "ar" ? "لا توجد علامة بعد" : "Add a brand first"}
        body={locale === "ar" ? "سمِّ علامتك وأضف كلمات للمراقبة لنبدأ بالبحث." : "Name your brand and add words to watch so we can start looking."}
        action={<Link href="/app/onboarding" className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-ink">{t(locale, "newBrand")}</Link>}
      />
    );
  }

  const mentions = await prisma.mention.findMany({
    where: {
      projectId: brand.id,
      ...(sp.source ? { source: sp.source as never } : {}),
      ...(sp.sentiment ? { sentiment: sp.sentiment as never } : {}),
      ...(sp.q
        ? { OR: [{ content: { contains: sp.q, mode: "insensitive" } }, { title: { contains: sp.q, mode: "insensitive" } }] }
        : {}),
    },
    orderBy: { publishedAt: "desc" },
    take: 80,
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title={t(locale, "mentions")}
        description={locale === "ar"
          ? "كل منشور عام يذكر كلماتك. الألوان تبيّن إن كان المزاج إيجابياً أو سلبياً."
          : "Every public post that includes your words. Colors show whether the mood is happy or upset."}
        tip={locale === "ar" ? "اضغط البطاقة لفتح المنشور الأصلي." : "Tap a card to open the original post."}
        actions={
          <form action={listenNowAction.bind(null, brand.id)}>
            <button className="rounded-xl bg-accent px-3 py-2 text-sm font-semibold text-accent-ink">{t(locale, "listenNow")}</button>
          </form>
        }
      />
      <BrandSwitcher brands={brands} currentId={brand.id} path="/app/mentions" label={t(locale, "brands")} />
      <form className="grid gap-2 md:grid-cols-4">
        <input name="q" defaultValue={sp.q} placeholder={locale === "ar" ? "ابحث في النص" : "Search the text"} />
        <select name="source" defaultValue={sp.source ?? ""}>
          <option value="">{locale === "ar" ? "كل المنصات" : "All platforms"}</option>
          {PLATFORMS.map((p) => (
            <option key={p.id} value={p.id}>{locale === "ar" ? p.nameAr : p.name}</option>
          ))}
        </select>
        <select name="sentiment" defaultValue={sp.sentiment ?? ""}>
          <option value="">{locale === "ar" ? "كل المشاعر" : "All moods"}</option>
          <option value="POSITIVE">{t(locale, "positive")}</option>
          <option value="NEUTRAL">{t(locale, "neutral")}</option>
          <option value="NEGATIVE">{t(locale, "negative")}</option>
        </select>
        {sp.brand ? <input type="hidden" name="brand" value={brand.id} /> : null}
        <button className="rounded-xl bg-bg-soft">{locale === "ar" ? "تصفية" : "Filter"}</button>
      </form>
      <div className="space-y-3">
        {mentions.length === 0 ? (
          <EmptyState
            title={locale === "ar" ? "لا إشارات مطابقة" : "No mentions match"}
            body={locale === "ar"
              ? "جرّب كلمة أخرى أو اضغط «ابحث عن إشارات جديدة». قد تستغرق النتائج دقيقة."
              : "Try another word, or tap Find new mentions. Results can take about a minute."}
          />
        ) : mentions.map((mention) => (
          <MentionCard key={mention.id} mention={mention} locale={locale} />
        ))}
      </div>
    </div>
  );
}
