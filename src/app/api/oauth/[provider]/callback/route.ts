import { Source } from "@prisma/client";
import { prisma } from "@/lib/db";
import { env, oauthRedirect } from "@/lib/config";
import { getJson } from "@/lib/connectors/http";
import { redirectTo } from "@/lib/redirects";

const PLATFORM: Record<string, Source> = {
  meta: "FACEBOOK",
  x: "X",
  linkedin: "LINKEDIN",
  google: "GOOGLE_BUSINESS",
};

export async function GET(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const stateRaw = url.searchParams.get("state");
  if (!code || !stateRaw) return redirectTo("/app/settings/platforms?error=oauth");
  const state = JSON.parse(Buffer.from(stateRaw, "base64url").toString());
  const redirectUri = oauthRedirect(provider);
  let accessToken = "";
  let refreshToken: string | undefined;
  let displayName = provider;
  let handle = provider;
  let externalId: string | undefined;

  try {
    if (provider === "meta") {
      const token = await getJson<{ access_token: string }>(
        `https://graph.facebook.com/v21.0/oauth/access_token?client_id=${env("META_APP_ID")}&client_secret=${env("META_APP_SECRET")}&redirect_uri=${encodeURIComponent(redirectUri)}&code=${code}`,
      );
      accessToken = token.access_token;
      const me = await getJson<{ name?: string; id?: string }>(`https://graph.facebook.com/v21.0/me?access_token=${accessToken}`);
      displayName = me.name ?? "Facebook";
      handle = me.id ?? "facebook";
      externalId = me.id;
    } else if (provider === "x") {
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
    }
  } catch {
    return redirectTo("/app/settings/platforms?error=oauth_exchange");
  }

  await prisma.socialAccount.create({
    data: {
      workspaceId: state.workspaceId,
      platform: PLATFORM[provider] ?? "X",
      displayName,
      handle,
      externalId,
      accessToken,
      refreshToken,
      status: "connected",
    },
  });
  return redirectTo("/app/settings/platforms?connected=1");
}
