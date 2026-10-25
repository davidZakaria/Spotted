import Link from "next/link";

const links = [
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/data-deletion", label: "Delete my data" },
];

export function SiteFooter({ compact = false }: { compact?: boolean }) {
  return (
    <footer className={compact ? "py-3 text-xs text-muted" : "border-t border-line px-6 py-8 text-sm text-muted"}>
      <div className={compact ? "flex flex-wrap items-center gap-x-3 gap-y-1" : "mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3"}>
        {compact ? null : <p>Spotted watches public conversation about your brand.</p>}
        <nav className="flex flex-wrap gap-x-4 gap-y-1">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="hover:text-ink">
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
