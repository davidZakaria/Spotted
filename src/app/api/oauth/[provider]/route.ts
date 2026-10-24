import { NextResponse } from "next/server";
import { env, oauthRedirect } from "@/lib/config";
import { requireSession } from "@/lib/auth";
import { redirectTo } from "@/lib/redirects";

const SCOPES: Record<string, string> = {
  meta: [
    "pages_show_list",
    "pages_read_engagement",
    "pages_read_user_content",
    "pages_manage_posts",
    "pages_manage_engagement",
    "pages_messaging",
    "pages_manage_metadata",
    "business_management",
    "instagram_basic",
    "instagram_manage_comments",
    "instagram_manage_insights",
    "instagram_content_publish",
    "instagram_manage_messages",
  ].join(","),
  x: "tweet.read tweet.write users.read dm.read dm.write offline.access",
  linkedin: "r_organization_social w_organization_social rw_organization_admin",
  google: "https://www.googleapis.com/auth/business.manage https://www.googleapis.com/auth/youtube https://www.googleapis.com/auth/yt-analytics.readonly",
  reddit: "identity read submit privatemessages",
  tiktok: "user.info.basic video.list video.publish",
  pinterest: "boards:read pins:read pins:write",
};

export async function GET(_req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const session = await requireSession();
  const { provider } = await params;
  const state = Buffer.from(JSON.stringify({ workspaceId: session.workspaceId, provider })).toString("base64url");
  const redirectUri = oauthRedirect(provider);
  let url = "";
  if (provider === "meta") {
    url = `https://www.facebook.com/v21.0/dialog/oauth?client_id=${env("META_APP_ID")}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(SCOPES.meta)}&state=${state}`;
  } else if (provider === "x") {
    url = `https://twitter.com/i/oauth2/authorize?response_type=code&client_id=${env("TWITTER_CLIENT_ID")}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(SCOPES.x)}&state=${state}&code_challenge=challenge&code_challenge_method=plain`;
  } else if (provider === "linkedin") {
    url = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${env("LINKEDIN_CLIENT_ID")}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(SCOPES.linkedin)}&state=${state}`;
  } else if (provider === "google") {
    url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${env("GOOGLE_GBP_CLIENT_ID") || env("GOOGLE_OAUTH_CLIENT_ID")}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(SCOPES.google)}&state=${state}&access_type=offline`;
  } else {
    return NextResponse.json({ error: `OAuth for ${provider} is documented but not wired in this environment` }, { status: 400 });
  }
  if (!url.includes("client_id=") || url.includes("client_id=&") || url.endsWith("client_id=")) {
    return redirectTo("/app/settings/platforms?error=missing_oauth_env");
  }
  return NextResponse.redirect(url);
}
