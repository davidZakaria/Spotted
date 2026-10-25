import Link from "next/link";
import type { ReactNode } from "react";
import { BrandMark } from "@/components/brand";
import { SiteFooter } from "@/components/site-footer";

export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
        <Link href="/">
          <BrandMark />
        </Link>
        <nav className="flex items-center gap-3 text-sm">
          <Link href="/login" className="text-muted hover:text-ink">Sign in</Link>
          <Link href="/signup" className="rounded-xl bg-accent px-3 py-2 font-medium text-accent-ink">Create account</Link>
        </nav>
      </header>
      <div className="flex-1">{children}</div>
      <SiteFooter />
    </div>
  );
}

export function LegalPage({
  title,
  updated,
  lead,
  children,
}: {
  title: string;
  updated: string;
  lead: string;
  children: ReactNode;
}) {
  return (
    <PublicShell>
      <main className="mx-auto w-full max-w-3xl px-6 pb-16 pt-4">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-accent">Spotted</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-muted">Last updated {updated}</p>
        <p className="mt-5 text-lg text-muted">{lead}</p>
        <div className="prose-legal mt-8 space-y-8 text-[15px] leading-7">{children}</div>
      </main>
    </PublicShell>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="card p-5 sm:p-6">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="mt-3 space-y-3 text-muted">{children}</div>
    </section>
  );
}
