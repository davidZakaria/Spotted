export class HttpError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: string,
  ) {
    super(message);
  }
}

export async function getJson<T = unknown>(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<T> {
  const { timeoutMs = 15000, ...rest } = init;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...rest,
      signal: ctrl.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; AetherListener/1.0; +https://github.com/aether) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
        Accept: "application/json",
        ...(rest.headers ?? {}),
      },
    });
    const text = await res.text();
    if (!res.ok) throw new HttpError(`${res.status} ${url}`, res.status, text.slice(0, 500));
    return text ? (JSON.parse(text) as T) : ({} as T);
  } finally {
    clearTimeout(t);
  }
}

export async function getText(url: string, init: RequestInit = {}) {
  const res = await fetch(url, {
    ...init,
    headers: {
      "User-Agent": "AetherSocial/1.0 (listening platform)",
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) throw new HttpError(`${res.status} ${url}`, res.status, await res.text());
  return res.text();
}

export async function postJson<T = unknown>(url: string, body: unknown, headers: Record<string, string> = {}) {
  return getJson<T>(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}
