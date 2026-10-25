import { NextResponse } from "next/server";
import { env, oauthRedirect } from "@/lib/config";
import { getSession } from "@/lib/auth";
import { redirectTo } from "@/lib/redirects";
import { logOauth } from "@/lib/oauth-errors";
import { hasGoogleOAuth, hasMetaAppKeys, hasThreadsKeys } from "@/lib/platform-status";
import { metaAuthorizeUrl, threadsAuthorizeUrl } from "@/lib/connectors/meta-oauth";

const SCOPES: Record<string, string> = {
  x: "tweet.read tweet.write users.read dm.read dm.write offline.access",
  linkedin: "r_organization_social w_organization_social rw_organization_admin",
  google: [
    "https://www.googleapis.com/auth/business.manage",
    "https://www.googleapis.com/auth/youtube",
    "https://www.googleapis.com/auth/yt-analytics.readonly",
  ].join(" "),
};

export async function GET(_req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const session = await getSession();
  const { provider } = await params;
  logOauth("start", { provider, signedIn: Boolean(session) });
  if (!session) {
    return redirectTo(`/login?next=${encodeURIComponent(`/api/oauth/${provider}`)}&error=${encodeURIComponent("Sign in first, then tap Connect.")}`);
  }

  const state = Buffer.from(JSON.stringify({ workspaceId: session.workspaceId, provider })).toString("base64url");
  let url = "";

  try {
    if (provider === "meta") {
      if (!hasMetaAppKeys()) {
        logOauth("start aborted", { provider, reason: "missing_meta_keys" });
        return redirectTo("/app/settings/platforms?error=missing_meta_keys");
      }
      url = metaAuthorizeUrl(state) ?? "";
    } else if (provider === "threads") {
      if (!hasThreadsKeys()) {
        logOauth("start aborted", { provider, reason: "missing_threads_keys" });
        return redirectTo("/app/settings/platforms?error=missing_threads_keys");
      }
      url = threadsAuthorizeUrl(state) ?? "";
    } else if (provider === "x") {
      const id = env("TWITTER_CLIENT_ID");
      if (!id) {
        logOauth("start aborted", { provider, reason: "missing_oauth_env" });
        return redirectTo("/app/settings/platforms?error=missing_oauth_env");
      }
      url = `https://twitter.com/i/oauth2/authorize?response_type=code&client_id=${encodeURIComponent(id)}&redirect_uri=${encodeURIComponent(oauthRedirect(provider))}&scope=${encodeURIComponent(SCOPES.x)}&state=${state}&code_challenge=challenge&code_challenge_method=plain`;
    } else if (provider === "linkedin") {
      const id = env("LINKEDIN_CLIENT_ID");
      if (!id) {
        logOauth("start aborted", { provider, reason: "missing_oauth_env" });
        return redirectTo("/app/settings/platforms?error=missing_oauth_env");
      }
      url = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${encodeURIComponent(id)}&redirect_uri=${encodeURIComponent(oauthRedirect(provider))}&scope=${encodeURIComponent(SCOPES.linkedin)}&state=${state}`;
    } else if (provider === "google") {
      if (!hasGoogleOAuth()) {
        logOauth("start aborted", { provider, reason: "missing_google_oauth" });
        return redirectTo("/app/settings/platforms?error=missing_google_oauth");
      }
      const id = env("GOOGLE_OAUTH_CLIENT_ID") || env("GOOGLE_GBP_CLIENT_ID");
      url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(id)}&redirect_uri=${encodeURIComponent(oauthRedirect(provider))}&response_type=code&scope=${encodeURIComponent(SCOPES.google)}&state=${state}&access_type=offline&prompt=consent`;
    } else {
      logOauth("start aborted", { provider, reason: "unknown_provider" });
      return NextResponse.json({ error: `We cannot connect ${provider} yet.` }, { status: 400 });
    }
  } catch (error) {
    logOauth("start failed", { provider, message: error instanceof Error ? error.message : "unknown" });
    return redirectTo("/app/settings/platforms?error=oauth");
  }

  if (!url) {
    logOauth("start aborted", { provider, reason: "empty_url" });
    return redirectTo("/app/settings/platforms?error=missing_oauth_env");
  }

  logOauth("start redirect", { provider, host: new URL(url).host });
  return NextResponse.redirect(url);
}
