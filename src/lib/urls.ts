import { env } from "./config";

export function publicAppUrl() {
  const raw = env("NEXT_PUBLIC_APP_URL") || env("APP_URL") || "http://127.0.0.1:4721";
  return raw.replace(/\/$/, "");
}

/** Build an absolute URL from APP_URL / NEXT_PUBLIC_APP_URL, never from the request host. */
export function absoluteUrl(path: string, base = publicAppUrl()) {
  const root = String(base || "http://127.0.0.1:4721").replace(/\/$/, "");
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${root}${suffix}`;
}
