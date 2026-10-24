import Link from "next/link";
import {
  Activity,
  CalendarDays,
  Inbox,
  LayoutDashboard,
  Plug,
  Settings,
  FileText,
  Radio,
} from "lucide-react";
import type { SessionUser } from "@/lib/auth";
import { t as tr } from "@/lib/i18n";
import { setLocaleAction } from "@/lib/actions";
import { BrandMark } from "@/components/brand";

const links = [
  { href: "/app", key: "overview" as const, icon: LayoutDashboard },
  { href: "/app/projects", key: "projects" as const, icon: Radio },
  { href: "/app/inbox", key: "inbox" as const, icon: Inbox },
  { href: "/app/publish", key: "publish" as const, icon: CalendarDays },
  { href: "/app/reports", key: "reports" as const, icon: FileText },
  { href: "/app/settings/sources", key: "sources" as const, icon: Plug },
  { href: "/app/settings", key: "settings" as const, icon: Settings },
];

export function Shell({
  session,
  children,
}: {
  session: SessionUser;
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
            <Link key={l.href} href={l.href} className="flex items-center gap-2 rounded-xl px-3 py-2 text-muted hover:bg-bg-soft hover:text-ink">
              <l.icon className="h-4 w-4" />
              {tr(locale, l.key)}
            </Link>
          ))}
        </nav>
        <div className="mt-auto space-y-3 pt-6 text-xs text-muted">
          <div className="rounded-xl border border-line p-3">
            <p className="font-medium text-ink">{session.workspaceName}</p>
            <p>{session.role.toLowerCase()} · {session.email}</p>
          </div>
          <form action="/api/auth/logout" method="post">
            <button className="w-full rounded-xl border border-line px-3 py-2 hover:bg-bg-soft">Sign out</button>
          </form>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-line px-4 py-3 md:px-8">
          <div className="flex items-center gap-2 text-sm text-muted md:hidden">
            <Activity className="h-4 w-4 text-accent" /> Spotted
          </div>
          <div className="ms-auto flex items-center gap-2">
            <form action={async () => {
              "use server";
              await setLocaleAction(locale === "ar" ? "en" : "ar");
            }}>
              <button className="rounded-xl border border-line px-3 py-1.5 text-xs">{locale === "ar" ? "English" : "العربية"}</button>
            </form>
            <Link href="/app/projects/new" className="rounded-xl bg-accent px-3 py-1.5 text-xs font-semibold text-bg">
              {tr(locale, "newProject")}
            </Link>
          </div>
        </header>
        <main className="flex-1 px-4 py-6 md:px-8">{children}</main>
      </div>
    </div>
  );
}
