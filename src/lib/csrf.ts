import { publicAppUrl } from "./urls";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function originFromUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

export function configuredOrigins(extra: string[] = []): string[] {
  const out = new Set<string>();
  for (const raw of [publicAppUrl(), process.env.APP_URL, process.env.NEXT_PUBLIC_APP_URL, ...extra]) {
    const origin = originFromUrl(raw ?? null);
    if (origin) out.add(origin);
  }
  return [...out];
}

export function csrfAllowed(input: {
  method: string;
  origin?: string | null;
  referer?: string | null;
  pathname: string;
  allowedOrigins: string[];
}): boolean {
  const method = input.method.toUpperCase();
  if (SAFE_METHODS.has(method)) return true;
  if (/^\/api\/oauth\/[^/]+\/callback$/.test(input.pathname)) return true;
  const origin = originFromUrl(input.origin ?? null) ?? originFromUrl(input.referer ?? null);
  if (!origin) return false;
  return input.allowedOrigins.includes(origin);
}
