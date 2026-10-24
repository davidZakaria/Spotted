import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { sentimentLabel } from "@/lib/i18n";

export function Button({
  children,
  className,
  variant = "primary",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger" | "soft" }) {
  const styles = {
    primary: "bg-accent text-accent-ink hover:brightness-110",
    ghost: "bg-transparent text-ink border border-line hover:bg-bg-soft",
    danger: "bg-bad/15 text-bad hover:bg-bad/25",
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
  return <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold", map[tone])}>{children}</span>;
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-ink">{label}</span>
      {children}
      {hint ? <span className="block text-xs text-muted">{hint}</span> : null}
    </label>
  );
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <Card className="py-12 text-center">
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted">{body}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </Card>
  );
}

export function SentimentPill({ value, locale = "en" }: { value: string; locale?: string }) {
  const tone = value === "POSITIVE" ? "good" : value === "NEGATIVE" ? "bad" : "muted";
  return <Badge tone={tone}>{sentimentLabel(locale, value)}</Badge>;
}

export function HelpTip({ text }: { text: string }) {
  return (
    <span className="group relative ms-1 inline-flex align-middle">
      <button
        type="button"
        className="grid h-5 w-5 place-items-center rounded-full border border-line text-[11px] font-semibold text-muted hover:border-accent hover:text-ink"
        aria-label={text}
      >
        ?
      </button>
      <span className="pointer-events-none absolute start-1/2 top-full z-30 mt-2 hidden w-64 -translate-x-1/2 rounded-xl border border-line bg-bg-elev p-3 text-start text-xs leading-5 text-ink shadow-lg group-hover:block group-focus-within:block rtl:translate-x-1/2">
        {text}
      </span>
    </span>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  tip,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  tip?: string;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight">
          {title}
          {tip ? <HelpTip text={tip} /> : null}
        </h1>
        {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function ChartBlock({
  title,
  explanation,
  tip,
  empty,
  children,
  className,
}: {
  title: string;
  explanation: string;
  tip?: string;
  empty?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={className}>
      <div className="mb-1 flex items-start justify-between gap-2">
        <h2 className="font-semibold">
          {title}
          {tip ? <HelpTip text={tip} /> : null}
        </h2>
      </div>
      <p className="mb-4 text-sm text-muted">{explanation}</p>
      {empty ?? children}
    </Card>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} />;
}

export function PageSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-80" />
      <div className="grid gap-4 sm:grid-cols-3">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
      <Skeleton className="h-64" />
    </div>
  );
}
