import Link from "next/link";
import {
  Bell,
  CalendarDays,
  CircleHelp,
  Home,
  Inbox,
  LineChart,
  MessageSquareText,
  Settings,
  FileText,
} from "lucide-react";
import type { SessionUser } from "@/lib/auth";
import { t as tr } from "@/lib/i18n";
import { setLocaleAction } from "@/lib/actions";
import { BrandMark } from "@/components/brand";
import { SiteFooter } from "@/components/site-footer";
import { ThemeToggle } from "@/components/theme-toggle";
import type { Theme } from "@/lib/theme";

const links = [
  { href: "/app", key: "home" as const, icon: Home },
  { href: "/app/mentions", key: "mentions" as const, icon: MessageSquareText },
  { href: "/app/analytics", key: "analytics" as const, icon: LineChart },
  { href: "/app/alerts", key: "alerts" as const, icon: Bell },
  { href: "/app/publish", key: "publish" as const, icon: CalendarDays },
  { href: "/app/inbox", key: "inbox" as const, icon: Inbox },
  { href: "/app/reports", key: "reports" as const, icon: FileText },
  { href: "/app/settings", key: "settings" as const, icon: Settings },
];

export function Shell({
  session,
  theme,
  children,
}: {
  session: SessionUser;
  theme: Theme;
  children: React.ReactNode;
}) {
  const locale = session.locale === "ar" ? "ar" : "en";
  return (
    <div className="flex min-h-screen" dir={locale === "ar" ? "rtl" : "ltr"}>
      <aside className="hidden w-60 shrink-0 border-line bg-bg-elev/80 p-4 md:flex md:flex-col md:border-e">
        <Link href="/app" className="mb-6 px-2">
          <BrandMark />
        </Link>
        <nav className="space-y-1 text-sm">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-muted hover:bg-bg-soft hover:text-ink">
              <l.icon className="h-4 w-4" />
              {tr(locale, l.key)}
            </Link>
          ))}
        </nav>
        <div className="mt-auto space-y-3 pt-6 text-xs text-muted">
          <Link href="/app/help" className="flex items-center gap-2 rounded-xl px-3 py-2 hover:bg-bg-soft hover:text-ink">
            <CircleHelp className="h-4 w-4" />
            {tr(locale, "help")}
          </Link>
          <div className="rounded-xl border border-line p-3">
            <p className="font-medium text-ink">{session.workspaceName}</p>
            <p>{session.email}</p>
          </div>
          <form action="/api/auth/logout" method="post">
            <button className="w-full rounded-xl border border-line px-3 py-2 hover:bg-bg-soft">{tr(locale, "signOut")}</button>
          </form>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 md:px-8">
          <Link href="/app" className="flex items-center gap-2 text-sm font-medium md:hidden">
            <BrandMark compact />
          </Link>
          <div className="ms-auto flex flex-wrap items-center justify-end gap-2">
            <ThemeToggle theme={theme} lightLabel={tr(locale, "lightMode")} darkLabel={tr(locale, "darkMode")} />
            <form action={async () => {
              "use server";
              await setLocaleAction(locale === "ar" ? "en" : "ar");
            }}>
              <button className="rounded-xl border border-line px-3 py-1.5 text-xs">{locale === "ar" ? "English" : "العربية"}</button>
            </form>
            <Link href="/app/onboarding" className="rounded-xl bg-accent px-3 py-1.5 text-xs font-semibold text-accent-ink">
              {tr(locale, "newBrand")}
            </Link>
          </div>
        </header>
        <main className="flex-1 px-4 py-6 md:px-8">{children}</main>
        <div className="hidden border-t border-line px-8 py-4 md:block">
          <SiteFooter compact />
        </div>
        <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-line bg-bg-elev/95 px-1 py-1 text-[11px] md:hidden">
          {links.slice(0, 5).map((l) => (
            <Link key={l.href} href={l.href} className="flex flex-col items-center gap-1 rounded-lg px-1 py-2 text-muted">
              <l.icon className="h-4 w-4" />
              {tr(locale, l.key)}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
