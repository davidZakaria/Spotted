import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function Button({
  children,
  className,
  variant = "primary",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger" | "soft" }) {
  const styles = {
    primary: "bg-accent text-bg hover:brightness-110",
    ghost: "bg-transparent text-ink border border-line hover:bg-bg-soft",
    danger: "bg-bad/20 text-bad hover:bg-bad/30",
    soft: "bg-bg-soft text-ink border border-line hover:border-accent",
  };
  return (
    <button
      className={cn("inline-flex items-center justify-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition disabled:opacity-50", styles[variant], className)}
      {...props}
    >
      {children}
    </button>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("card p-5", className)}>{children}</div>;
}

export function Badge({
  children,
  tone = "muted",
}: {
  children: ReactNode;
  tone?: "muted" | "good" | "bad" | "warn" | "accent";
}) {
  const map = {
    muted: "bg-bg-soft text-muted",
    good: "bg-good/15 text-good",
    bad: "bg-bad/15 text-bad",
    warn: "bg-warn/15 text-warn",
    accent: "bg-accent/15 text-accent",
  };
  return <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium", map[tone])}>{children}</span>;
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium uppercase tracking-wide text-muted">{label}</span>
      {children}
      {hint ? <span className="block text-xs text-muted">{hint}</span> : null}
    </label>
  );
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <Card className="text-center py-12">
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-muted max-w-md mx-auto">{body}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </Card>
  );
}

export function SentimentPill({ value }: { value: string }) {
  const tone = value === "POSITIVE" ? "good" : value === "NEGATIVE" ? "bad" : "muted";
  return <Badge tone={tone}>{value.toLowerCase()}</Badge>;
}
