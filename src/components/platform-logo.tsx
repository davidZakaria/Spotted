import type { Source } from "@prisma/client";
import { cn } from "@/lib/utils";
import { platformInfo } from "@/lib/platforms";

const COLORS: Partial<Record<Source, string>> = {
  REDDIT: "#ff4500",
  HACKER_NEWS: "#ff6600",
  GOOGLE_NEWS: "#4285f4",
  BLUESKY: "#1185fe",
  MASTODON: "#6364ff",
  RSS: "#f26522",
  PODCASTS: "#7c3aed",
  GOOGLE_ALERTS: "#34a853",
  APP_STORE: "#0a84ff",
  TELEGRAM: "#229ed9",
  YOUTUBE: "#ff0000",
  X: "#111111",
  FACEBOOK: "#1877f2",
  INSTAGRAM: "#e1306c",
  THREADS: "#111111",
  LINKEDIN: "#0a66c2",
  TIKTOK: "#111111",
  WEB_SEARCH: "#0f766e",
  QUORA: "#b92b27",
  PINTEREST: "#e60023",
  DISCORD: "#5865f2",
  TWITCH: "#9146ff",
  GOOGLE_BUSINESS: "#4285f4",
  GOOGLE_TRENDS: "#fbbc04",
  TRUSTPILOT: "#00b67a",
  G2: "#ff492c",
  PLAY_STORE: "#34a853",
  SNAPCHAT: "#fffc00",
};

function glyph(id: Source) {
  const map: Partial<Record<Source, string>> = {
    REDDIT: "r",
    HACKER_NEWS: "Y",
    GOOGLE_NEWS: "G",
    BLUESKY: "b",
    MASTODON: "m",
    RSS: "≡",
    PODCASTS: "♪",
    GOOGLE_ALERTS: "A",
    APP_STORE: "",
    TELEGRAM: "✈",
    YOUTUBE: "▶",
    X: "X",
    FACEBOOK: "f",
    INSTAGRAM: "◎",
    THREADS: "@",
    LINKEDIN: "in",
    TIKTOK: "♪",
    WEB_SEARCH: "◎",
    QUORA: "Q",
    PINTEREST: "P",
    DISCORD: "d",
    TWITCH: "Tw",
    GOOGLE_BUSINESS: "g",
    GOOGLE_TRENDS: "↗",
    TRUSTPILOT: "★",
    G2: "G2",
    PLAY_STORE: "▶",
    SNAPCHAT: "👻",
  };
  return map[id] ?? id.slice(0, 1);
}

export function PlatformLogo({
  id,
  size = 28,
  className,
}: {
  id: Source;
  size?: number;
  className?: string;
}) {
  const info = platformInfo(id);
  const bg = COLORS[id] ?? "#5b6b80";
  const darkText = id === "SNAPCHAT" || id === "GOOGLE_TRENDS";
  return (
    <span
      title={info?.name ?? id}
      className={cn("inline-grid shrink-0 place-items-center rounded-lg font-bold leading-none", className)}
      style={{
        width: size,
        height: size,
        background: bg,
        color: darkText ? "#111" : "#fff",
        fontSize: size < 26 ? 10 : 12,
      }}
    >
      {glyph(id)}
    </span>
  );
}

export function PlatformName({ id, locale = "en" }: { id: Source; locale?: string }) {
  const info = platformInfo(id);
  if (!info) return <>{id}</>;
  return <>{locale === "ar" ? info.nameAr : info.name}</>;
}
