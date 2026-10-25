const RELATIVE = /^(?:about\s+)?(\d+|a|an)\s+(second|minute|hour|day|week|month|year)s?\s+ago$/i;
const MS = {
  second: 1000,
  minute: 60 * 1000,
  hour: 60 * 60 * 1000,
  day: 24 * 60 * 60 * 1000,
  week: 7 * 24 * 60 * 60 * 1000,
  month: 30 * 24 * 60 * 60 * 1000,
  year: 365 * 24 * 60 * 60 * 1000,
} as const;

export function isValidDate(value: Date | null | undefined): value is Date {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

export function safeIso(value: Date | null | undefined, fallback = new Date()): string {
  return (isValidDate(value) ? value : fallback).toISOString();
}

/** Parse SerpAPI / RSS / App Store / Graph dates. Never returns an Invalid Date. */
export function parsePublishedAt(value: unknown, fallback: Date = new Date()): Date {
  const now = isValidDate(fallback) ? fallback : new Date();
  if (value == null || value === "") return new Date(now.getTime());
  if (value instanceof Date) return isValidDate(value) ? value : new Date(now.getTime());
  if (typeof value === "number" && Number.isFinite(value)) {
    const ms = value > 0 && value < 1e12 ? value * 1000 : value;
    const fromNumber = new Date(ms);
    return isValidDate(fromNumber) ? fromNumber : new Date(now.getTime());
  }
  if (typeof value !== "string") return new Date(now.getTime());
  const raw = value.trim();
  if (!raw) return new Date(now.getTime());

  const relative = parseRelativeDate(raw, now);
  if (relative) return relative;

  for (const candidate of dateCandidates(raw)) {
    const parsed = new Date(candidate);
    if (isValidDate(parsed)) return parsed;
  }
  return new Date(now.getTime());
}

export function parseRelativeDate(raw: string, now: Date = new Date()): Date | null {
  const text = raw.trim().toLowerCase();
  if (!text) return null;
  if (text === "now" || text === "just now" || text === "today") return new Date(now.getTime());
  if (text === "yesterday") return new Date(now.getTime() - MS.day);
  const match = text.match(RELATIVE);
  if (!match) return null;
  const amount = match[1] === "a" || match[1] === "an" ? 1 : Number(match[1]);
  const unit = match[2] as keyof typeof MS;
  if (!Number.isFinite(amount) || amount < 0 || !MS[unit]) return null;
  return new Date(now.getTime() - amount * MS[unit]);
}

function dateCandidates(raw: string): string[] {
  const out = [raw];
  // SerpAPI Google News: "10/24/2024, 08:30 AM, +0000 UTC"
  const utcOffset = raw.replace(/,?\s*([+-]\d{4})\s*UTC$/i, " GMT$1");
  if (utcOffset !== raw) out.push(utcOffset);
  const dropUtc = raw.replace(/,?\s*[+-]\d{4}\s*UTC$/i, "").replace(/,?\s*UTC$/i, "");
  if (dropUtc !== raw) out.push(dropUtc);
  // "Oct 24, 2024 10:00 AM"
  const compact = raw.replace(/,/g, " ").replace(/\s+/g, " ").trim();
  if (compact !== raw) out.push(compact);
  // "Oct 24" (no year) — assume current year
  if (/^[A-Za-z]{3,9}\s+\d{1,2}$/.test(raw)) {
    out.push(`${raw}, ${new Date().getUTCFullYear()}`);
  }
  return out;
}
