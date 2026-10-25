import { prisma } from "@/lib/db";
import { env, oauthRedirect } from "@/lib/config";
import { getJson } from "@/lib/connectors/http";
import {
  exchangeMetaUserToken,
  exchangeThreadsUserToken,
  listManagedPages,
  socialRowsFromPages,
  threadsProfile,
} from "@/lib/connectors/meta-oauth";
import { redirectTo } from "@/lib/redirects";
import { logOauth } from "@/lib/oauth-errors";
import type { Source } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { consumeOauthState } from "@/lib/oauth-state";
import { writeAudit } from "@/lib/audit";
import { clientIp } from "@/lib/rate-limit";

const PLATFORM: Record<string, Source> = {
  x: "X",
  linkedin: "LINKEDIN",
  google: "GOOGLE_BUSINESS",
};

async function upsertAccount(data: {
  workspaceId: string;
  platform: Source;
  displayName: string;
  handle: string;
  externalId?: string | null;
  accessToken?: string;
  refreshToken?: string;
  status?: string;
  metadata?: Record<string, unknown>;
}) {
  const existing = data.externalId
    ? await prisma.socialAccount.findFirst({
        where: { workspaceId: data.workspaceId, platform: data.platform, externalId: data.externalId },
      })
    : null;
  const payload = {
    displayName: data.displayName,
    handle: data.handle,
    externalId: data.externalId ?? undefined,
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    status: data.status ?? "connected",
    isMock: false,
    metadata: data.metadata as never,
  };
  if (existing) {
    return prisma.socialAccount.update({ where: { id: existing.id }, data: payload });
  }
  return prisma.socialAccount.create({
    data: {
      workspaceId: data.workspaceId,
      platform: data.platform,
      ...payload,
    },
  });
}

export async function GET(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const denied = url.searchParams.get("error");
  const stateRaw = url.searchParams.get("state");
  logOauth("callback", { provider, hasCode: Boolean(code), denied: denied ?? null });

  if (denied) {
    logOauth("callback denied", { provider, denied, description: url.searchParams.get("error_description") });
    return redirectTo("/app/settings/platforms?error=oauth");
  }
  if (!code || !stateRaw) {
    logOauth("callback missing code or state", { provider });
    return redirectTo("/app/settings/platforms?error=oauth");
  }

  const session = await getSession();
  if (!session) {
    logOauth("callback no session", { provider });
    return redirectTo("/login?error=not_signed_in");
  }
  let workspaceId = "";
  try {
    const state = await consumeOauthState({
      state: stateRaw,
      provider,
      userId: session.id,
      workspaceId: session.workspaceId,
    });
    workspaceId = state.workspaceId;
  } catch {
    logOauth("callback bad state", { provider });
    return redirectTo("/app/settings/platforms?error=oauth");
  }
  if (!workspaceId || workspaceId !== session.workspaceId) {
    return redirectTo("/app/settings/platforms?error=oauth");
  }

  try {
    if (provider === "meta") {
      const userToken = await exchangeMetaUserToken(code);
      const pages = await listManagedPages(userToken);
      if (!pages.length) {
        logOauth("callback no pages", { provider, workspaceId });
        return redirectTo("/app/settings/platforms?error=no_pages");
      }
      const rows = socialRowsFromPages(workspaceId, pages, userToken);
      for (const row of rows) {
        await upsertAccount(row);
      }
      logOauth("callback stored pages", { provider, pages: pages.length, rows: rows.length });
      await writeAudit({
        action: "oauth.connect",
        userId: session.id,
        workspaceId,
        ip: clientIp(req.headers),
        metadata: { provider, pages: pages.length },
      });
      return redirectTo(`/app/settings/platforms?connected=1&pages=${pages.length}`);
    }

    if (provider === "threads") {
      const token = await exchangeThreadsUserToken(code);
      const profile = await threadsProfile(token.accessToken);
      const externalId = profile.id || token.userId;
      if (!externalId) {
        logOauth("callback no threads profile", { provider, workspaceId });
        return redirectTo("/app/settings/platforms?error=oauth_exchange");
      }
      await upsertAccount({
        workspaceId,
        platform: "THREADS",
        displayName: profile.name || profile.username || "Threads",
        handle: profile.username || externalId,
        externalId,
        accessToken: token.accessToken,
      });
      logOauth("callback stored threads", { provider });
      await writeAudit({
        action: "oauth.connect",
        userId: session.id,
        workspaceId,
        ip: clientIp(req.headers),
        metadata: { provider },
      });
      return redirectTo("/app/settings/platforms?connected=1");
    }

    const redirectUri = oauthRedirect(provider);
    let accessToken = "";
    let refreshToken: string | undefined;
    let displayName = provider;
    let handle = provider;
    let externalId: string | undefined;

    if (provider === "x") {
      const basic = Buffer.from(`${env("TWITTER_CLIENT_ID")}:${env("TWITTER_CLIENT_SECRET")}`).toString("base64");
      const token = await getJson<{ access_token: string; refresh_token?: string }>("https://api.x.com/2/oauth2/token", {
        method: "POST",
        headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          grant_type: "authorization_code",
          redirect_uri: redirectUri,
          code_verifier: "challenge",
        }).toString(),
      });
      accessToken = token.access_token;
      refreshToken = token.refresh_token;
      displayName = "X account";
      handle = "x";
    } else if (provider === "linkedin") {
      const token = await getJson<{ access_token: string }>("https://www.linkedin.com/oauth/v2/accessToken", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri: redirectUri,
          client_id: env("LINKEDIN_CLIENT_ID"),
          client_secret: env("LINKEDIN_CLIENT_SECRET"),
        }).toString(),
      });
      accessToken = token.access_token;
      displayName = "LinkedIn Page";
      handle = "linkedin";
    } else if (provider === "google") {
      const token = await getJson<{ access_token: string; refresh_token?: string }>("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: env("GOOGLE_GBP_CLIENT_ID") || env("GOOGLE_OAUTH_CLIENT_ID"),
          client_secret: env("GOOGLE_GBP_CLIENT_SECRET") || env("GOOGLE_OAUTH_CLIENT_SECRET"),
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        }).toString(),
      });
      accessToken = token.access_token;
      refreshToken = token.refresh_token;
      displayName = "Google account";
      handle = "google";
    } else {
      return redirectTo("/app/settings/platforms?error=missing_oauth_env");
    }

    await upsertAccount({
      workspaceId,
      platform: PLATFORM[provider] ?? "X",
      displayName,
      handle,
      externalId,
      accessToken,
      refreshToken,
    });
    logOauth("callback stored account", { provider });
    await writeAudit({
      action: "oauth.connect",
      userId: session.id,
      workspaceId,
      ip: clientIp(req.headers),
      metadata: { provider },
    });
    return redirectTo("/app/settings/platforms?connected=1");
  } catch (error) {
    logOauth("callback exchange failed", {
      provider,
      message: error instanceof Error ? error.message : "unknown",
      status: typeof error === "object" && error && "status" in error ? (error as { status: number }).status : undefined,
    });
    return redirectTo("/app/settings/platforms?error=oauth_exchange");
  }
}
