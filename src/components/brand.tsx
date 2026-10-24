import { cn } from "@/lib/utils";

export function BrandMark({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent text-sm font-bold text-bg">S</span>
      <span className="leading-tight">
        <span className="block font-semibold tracking-tight">Spotted</span>
        {compact ? null : (
          <span className="block text-[10px] font-medium uppercase tracking-[0.18em] text-muted">everywhere</span>
        )}
      </span>
    </span>
  );
}
