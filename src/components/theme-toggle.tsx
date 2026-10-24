"use client";

import { Moon, Sun } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

export function ThemeToggle({ theme, lightLabel, darkLabel }: { theme: "light" | "dark"; lightLabel: string; darkLabel: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const next = theme === "dark" ? "light" : "dark";

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        document.documentElement.setAttribute("data-theme", next);
        document.cookie = `spotted_theme=${next}; path=/; max-age=31536000; samesite=lax`;
        start(() => router.refresh());
      }}
      className="inline-flex items-center gap-1.5 rounded-xl border border-line px-2.5 py-1.5 text-xs hover:bg-bg-soft"
      aria-label={next === "light" ? lightLabel : darkLabel}
    >
      {theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
      {theme === "dark" ? lightLabel : darkLabel}
    </button>
  );
}
