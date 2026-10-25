import { env, oauthRedirect } from "../config";
import { getJson } from "./http";

export const META_SCOPES = [
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
];

export type ManagedPage = {
  id: string;
  name: string;
  access_token: string;
  instagram_business_account?: { id: string; username?: string; name?: string };
};

function graphVersion() {
  return env("META_GRAPH_VERSION", "v21.0");
}

export function metaAuthorizeUrl(state: string, appId = env("META_APP_ID")) {
  if (!appId) return null;
  const redirectUri = oauthRedirect("meta");
  const usp = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    scope: META_SCOPES.join(","),
    state,
    response_type: "code",
  });
  return `https://www.facebook.com/${graphVersion()}/dialog/oauth?${usp}`;
}

export async function exchangeMetaUserToken(code: string) {
  const redirectUri = oauthRedirect("meta");
  const short = await getJson<{ access_token?: string; error?: { message?: string } }>(
    `https://graph.facebook.com/${graphVersion()}/oauth/access_token?${new URLSearchParams({
      client_id: env("META_APP_ID"),
      client_secret: env("META_APP_SECRET"),
      redirect_uri: redirectUri,
      code,
    })}`,
  );
  if (!short.access_token) {
    throw new Error(short.error?.message || "Facebook did not return an access token");
  }
  try {
    const longLived = await getJson<{ access_token?: string }>(
      `https://graph.facebook.com/${graphVersion()}/oauth/access_token?${new URLSearchParams({
        grant_type: "fb_exchange_token",
        client_id: env("META_APP_ID"),
        client_secret: env("META_APP_SECRET"),
        fb_exchange_token: short.access_token,
      })}`,
    );
    return longLived.access_token || short.access_token;
  } catch {
    return short.access_token;
  }
}

export async function listManagedPages(userToken: string): Promise<ManagedPage[]> {
  const data = await getJson<{ data?: ManagedPage[]; error?: { message?: string } }>(
    `https://graph.facebook.com/${graphVersion()}/me/accounts?${new URLSearchParams({
      fields: "id,name,access_token,instagram_business_account{id,username,name}",
      access_token: userToken,
      limit: "50",
    })}`,
  );
  if (data.error?.message) throw new Error(data.error.message);
  return (data.data ?? []).filter((page) => page.id && page.access_token);
}

export function socialRowsFromPages(workspaceId: string, pages: ManagedPage[], userToken: string) {
  const rows: {
    workspaceId: string;
    platform: "FACEBOOK" | "INSTAGRAM";
    displayName: string;
    handle: string;
    externalId: string;
    accessToken: string;
    refreshToken?: string;
    status: string;
    metadata: Record<string, unknown>;
  }[] = [];

  for (const page of pages) {
    rows.push({
      workspaceId,
      platform: "FACEBOOK",
      displayName: page.name,
      handle: page.id,
      externalId: page.id,
      accessToken: page.access_token,
      refreshToken: userToken,
      status: "connected",
      metadata: {
        kind: "page",
        instagramBusinessAccount: page.instagram_business_account ?? null,
      },
    });
    const ig = page.instagram_business_account;
    if (ig?.id) {
      rows.push({
        workspaceId,
        platform: "INSTAGRAM",
        displayName: ig.name || ig.username || page.name,
        handle: ig.username || ig.id,
        externalId: ig.id,
        accessToken: page.access_token,
        refreshToken: userToken,
        status: "connected",
        metadata: { kind: "ig_business", pageId: page.id },
      });
    }
  }
  return rows;
}

export const THREADS_SCOPES = [
  "threads_basic",
  "threads_content_publish",
  "threads_manage_replies",
  "threads_manage_insights",
  "threads_read_replies",
];

export function threadsAuthorizeUrl(state: string, appId = env("THREADS_APP_ID")) {
  if (!appId) return null;
  const usp = new URLSearchParams({
    client_id: appId,
    redirect_uri: oauthRedirect("threads"),
    scope: THREADS_SCOPES.join(","),
    state,
    response_type: "code",
  });
  return `https://threads.net/oauth/authorize?${usp}`;
}

export async function exchangeThreadsUserToken(code: string) {
  const short = await getJson<{ access_token?: string; user_id?: string; error?: { message?: string } }>(
    "https://graph.threads.net/oauth/access_token",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: env("THREADS_APP_ID"),
        client_secret: env("THREADS_APP_SECRET"),
        grant_type: "authorization_code",
        redirect_uri: oauthRedirect("threads"),
        code,
      }).toString(),
    },
  );
  if (!short.access_token) {
    throw new Error(short.error?.message || "Threads did not return an access token");
  }
  try {
    const longLived = await getJson<{ access_token?: string }>(
      `https://graph.threads.net/access_token?${new URLSearchParams({
        grant_type: "th_exchange_token",
        client_secret: env("THREADS_APP_SECRET"),
        access_token: short.access_token,
      })}`,
    );
    return { accessToken: longLived.access_token || short.access_token, userId: short.user_id };
  } catch {
    return { accessToken: short.access_token, userId: short.user_id };
  }
}

export async function threadsProfile(accessToken: string) {
  return getJson<{ id?: string; username?: string; name?: string }>(
    `https://graph.threads.net/${graphVersion()}/me?${new URLSearchParams({
      fields: "id,username,name",
      access_token: accessToken,
    })}`,
  );
}
