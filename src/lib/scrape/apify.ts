const APIFY = "https://api.apify.com/v2";

export function apifyToken(e: Record<string, string | undefined> = process.env) {
  return (e.APIFY_TOKEN ?? e.APIFY_API_TOKEN ?? "").trim();
}

export function hasApifyToken(e: Record<string, string | undefined> = process.env) {
  return Boolean(apifyToken(e));
}

export function apifyMonthlyLimitUsd(workspaceLimit?: number, e: Record<string, string | undefined> = process.env) {
  const fromEnv = Number(e.APIFY_MONTHLY_LIMIT_USD ?? "");
  if (Number.isFinite(workspaceLimit) && (workspaceLimit ?? 0) > 0) return workspaceLimit as number;
  return Number.isFinite(fromEnv) && fromEnv > 0 ? fromEnv : 25;
}

export function actorPath(actorId: string) {
  return actorId.trim().replace(/\//g, "~");
}

export function missingTokenMessage(locale: string) {
  return locale === "ar"
    ? "أضف APIFY_TOKEN في ملف البيئة. انسخه من console.apify.com ثم أعد تشغيل التطبيق. لا نطلب كوكيز أو كلمات مرور المواقع."
    : "Add APIFY_TOKEN to your environment. Copy it from console.apify.com, then restart the app. We never ask for site cookies or passwords.";
}

async function apifyGet<T>(path: string, token: string) {
  const res = await fetch(`${APIFY}${path}${path.includes("?") ? "&" : "?"}token=${encodeURIComponent(token)}`, {
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: { message?: string } };
  if (!res.ok) {
    throw new Error(data.error?.message || `Apify request failed (${res.status})`);
  }
  return data;
}

export type ApifyUsage = {
  usedUsd: number;
  limitUsd?: number;
  username?: string;
};

export async function fetchApifyUsage(): Promise<ApifyUsage> {
  const token = apifyToken();
  if (!token) return { usedUsd: 0 };
  try {
    const [me, usage] = await Promise.all([
      apifyGet<{ data?: { username?: string } }>("/users/me", token),
      apifyGet<{
        data?: {
          totalUsageCreditsUsdAfterVolumeDiscount?: number;
          monthlyServiceUsageUsd?: number;
          afterVolumeDiscountUsd?: number;
          serviceUsageUsd?: number;
        };
      }>("/users/me/usage/monthly", token),
    ]);
    const row = usage.data ?? {};
    const usedUsd =
      Number(
        row.totalUsageCreditsUsdAfterVolumeDiscount ??
          row.afterVolumeDiscountUsd ??
          row.monthlyServiceUsageUsd ??
          row.serviceUsageUsd ??
          0,
      ) || 0;
    return { usedUsd, username: me.data?.username };
  } catch {
    return { usedUsd: 0 };
  }
}

export async function startApifyRun(actorId: string, input: Record<string, unknown>) {
  const token = apifyToken();
  if (!token) throw new Error(missingTokenMessage("en"));
  const res = await fetch(`${APIFY}/acts/${actorPath(actorId)}/runs?token=${encodeURIComponent(token)}&timeout=300`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = (await res.json().catch(() => ({}))) as {
    data?: { id?: string; defaultDatasetId?: string; status?: string };
    error?: { message?: string };
  };
  if (!res.ok || !data.data?.id) {
    throw new Error(data.error?.message || `Could not start Apify actor ${actorId} (${res.status})`);
  }
  return { runId: data.data.id, datasetId: data.data.defaultDatasetId, status: data.data.status ?? "RUNNING" };
}

export async function getApifyRun(runId: string) {
  const token = apifyToken();
  const data = await apifyGet<{
    data?: {
      id?: string;
      status?: string;
      defaultDatasetId?: string;
      usageTotalUsd?: number;
      statusMessage?: string;
    };
  }>(`/actor-runs/${runId}`, token);
  return data.data ?? {};
}

export async function getApifyItems(datasetId: string, limit = 400) {
  const token = apifyToken();
  const res = await fetch(
    `${APIFY}/datasets/${datasetId}/items?token=${encodeURIComponent(token)}&limit=${Math.min(limit, 500)}`,
  );
  if (!res.ok) throw new Error(`Could not read Apify results (${res.status})`);
  const rows = (await res.json()) as unknown;
  return Array.isArray(rows) ? (rows as Record<string, unknown>[]) : [];
}

export async function waitForApifyRun(runId: string, timeoutMs = 8 * 60 * 1000) {
  const started = Date.now();
  let last = await getApifyRun(runId);
  while (Date.now() - started < timeoutMs) {
    const status = (last.status ?? "").toUpperCase();
    if (["SUCCEEDED", "FAILED", "ABORTED", "TIMED-OUT"].includes(status)) return last;
    await new Promise((resolve) => setTimeout(resolve, 8000));
    last = await getApifyRun(runId);
  }
  return last;
}
