import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Card, PageHeader } from "@/components/ui";
import { t } from "@/lib/i18n";

export default async function SettingsPage() {
  const session = await requireSession();
  const locale = session.locale === "ar" ? "ar" : "en";
  const [members, accounts, brands] = await Promise.all([
    prisma.membership.count({ where: { workspaceId: session.workspaceId } }),
    prisma.socialAccount.count({ where: { workspaceId: session.workspaceId } }),
    prisma.project.count({ where: { workspaceId: session.workspaceId } }),
  ]);

  const tiles = [
    {
      href: "/app/settings/platforms",
      title: t(locale, "platforms"),
      body: locale === "ar"
        ? "اربط فيسبوك وإنستغرام وإكس وغيرها. يظهر ما يعمل الآن وما يحتاج حساباً."
        : "Connect Facebook, Instagram, X, and the rest. See what works now and what needs an account.",
    },
    {
      href: "/app/settings/members",
      title: locale === "ar" ? "الفريق" : "Your team",
      body: locale === "ar"
        ? `${members} أشخاص في ${session.workspaceName}.`
        : `${members} people in ${session.workspaceName}.`,
    },
    {
      href: "/app/onboarding",
      title: t(locale, "brands"),
      body: locale === "ar" ? `${brands} علامات. أضف علامة جديدة في أي وقت.` : `${brands} brands. Add another anytime.`,
    },
    {
      href: "/app/help",
      title: t(locale, "help"),
      body: locale === "ar" ? "شرح قصير لغير المختصين." : "A short tour written for non-technical teammates.",
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title={t(locale, "settings")}
        description={locale === "ar"
          ? "الحسابات، الفريق، والعلامات — بلا مصطلحات تقنية."
          : "Accounts, teammates, and brands — without the technical jargon."}
      />
      <p className="text-sm text-muted">{locale === "ar" ? "حسابات مربوطة:" : "Connected accounts:"} {accounts}</p>
      <div className="grid gap-4 md:grid-cols-2">
        {tiles.map((tile) => (
          <Link key={tile.href} href={tile.href}>
            <Card className="h-full hover:border-accent/50">
              <p className="font-semibold">{tile.title}</p>
              <p className="mt-2 text-sm text-muted">{tile.body}</p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
