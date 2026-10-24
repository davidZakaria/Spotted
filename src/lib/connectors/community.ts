import * as cheerio from "cheerio";
import { env } from "../config";
import { getJson, getText, postJson } from "./http";
import type { Connector, InboxPayload, RawMention } from "./types";

export const pinterestConnector: Connector = {
  id: "PINTEREST",
  name: "Pinterest",
  family: "Pinterest",
  docsUrl: "https://developers.pinterest.com/",
  keyless: false,
  capabilities: [],
  isConfigured: () => Boolean(env("PINTEREST_APP_ID")),
  async search(ctx) {
    if (!ctx.accessToken) return [];
    const data = await getJson<{ items?: { id: string; title?: string; description?: string; link?: string; created_at?: string }[] }>(
      `https://api.pinterest.com/v5/search/pins?query=${encodeURIComponent(ctx.query)}&page_size=15`,
      { headers: { Authorization: `Bearer ${ctx.accessToken}` } },
    );
    return (data.items ?? []).map((p) => ({
      source: "PINTEREST" as const,
      externalId: p.id,
      url: p.link ?? `https://www.pinterest.com/pin/${p.id}`,
      title: p.title,
      content: p.description ?? p.title ?? "",
      publishedAt: p.created_at ? new Date(p.created_at) : new Date(),
      kind: "pin",
    }));
  },
  async publish(input) {
    if (!input.accessToken) throw new Error("Pinterest publishing requires OAuth");
    const res = await postJson<{ id?: string }>(
      "https://api.pinterest.com/v5/pins",
      { title: input.content.slice(0, 80), description: input.content, media_source: { source_type: "image_url", url: input.mediaUrls?.[0] } },
      { Authorization: `Bearer ${input.accessToken}` },
    );
    return { externalId: res.id ?? "pin" };
  },
};

export const telegramConnector: Connector = {
  id: "TELEGRAM",
  name: "Telegram",
  family: "Telegram",
  docsUrl: "https://core.telegram.org/bots/api",
  keyless: true,
  capabilities: [],
  isConfigured: () => true,
  async search(ctx) {
    const channels = ctx.projectConfig?.telegramChannels ?? [];
    const out: RawMention[] = [];
    for (const channel of channels.slice(0, 8)) {
      const name = channel.replace(/^@/, "");
      try {
        const html = await getText(`https://t.me/s/${encodeURIComponent(name)}`);
        const $ = cheerio.load(html);
        $(".tgme_widget_message").each((_, el) => {
          const text = $(el).find(".tgme_widget_message_text").text();
          const href = $(el).find(".tgme_widget_message_date").attr("href") ?? `https://t.me/${name}`;
          const views = $(el).find(".tgme_widget_message_views").text();
          const date = $(el).find("time").attr("datetime");
          if (ctx.query && !text.toLowerCase().includes(ctx.query.toLowerCase())) return;
          out.push({
            source: "TELEGRAM",
            externalId: href,
            url: href,
            content: text,
            authorHandle: name,
            authorName: name,
            publishedAt: date ? new Date(date) : new Date(),
            viewCount: Number(views.replace(/[^\d]/g, "")) || 0,
            reach: Number(views.replace(/[^\d]/g, "")) || 0,
            kind: "post",
          });
        });
      } catch {
        // skip
      }
    }
    return out;
  },
  async publish(input) {
    const bot = env("TELEGRAM_BOT_TOKEN");
    if (!bot || !input.accountExternalId) throw new Error("Telegram publishing requires TELEGRAM_BOT_TOKEN and a chat id");
    const res = await getJson<{ result?: { message_id: number } }>(
      `https://api.telegram.org/bot${bot}/sendMessage?chat_id=${encodeURIComponent(input.accountExternalId)}&text=${encodeURIComponent(input.content)}`,
    );
    return { externalId: String(res.result?.message_id ?? "tg") };
  },
  async fetchInbox() {
    const bot = env("TELEGRAM_BOT_TOKEN");
    if (!bot) return [];
    const data = await getJson<{ result?: { update_id: number; message?: { text?: string; from?: { first_name?: string }; date?: number; message_id?: number } }[] }>(
      `https://api.telegram.org/bot${bot}/getUpdates?limit=20`,
    );
    return (data.result ?? []).flatMap((u) => {
      if (!u.message?.text) return [];
      return [{
        externalId: String(u.message.message_id ?? u.update_id),
        type: "MESSAGE" as const,
        authorName: u.message.from?.first_name ?? "Telegram user",
        content: u.message.text,
        receivedAt: u.message.date ? new Date(u.message.date * 1000) : new Date(),
      } satisfies InboxPayload];
    });
  },
};

export const discordConnector: Connector = {
  id: "DISCORD",
  name: "Discord",
  family: "Discord",
  docsUrl: "https://discord.com/developers/docs",
  keyless: false,
  capabilities: [],
  isConfigured: () => Boolean(env("DISCORD_BOT_TOKEN")),
  async search(ctx) {
    const token = env("DISCORD_BOT_TOKEN");
    if (!token) return [];
    const guilds = await getJson<{ id: string }[]>("https://discord.com/api/v10/users/@me/guilds", {
      headers: { Authorization: `Bot ${token}` },
    });
    const out: RawMention[] = [];
    for (const g of guilds.slice(0, 3)) {
      const channels = await getJson<{ id: string; type: number }[]>(`https://discord.com/api/v10/guilds/${g.id}/channels`, {
        headers: { Authorization: `Bot ${token}` },
      });
      for (const ch of channels.filter((c) => c.type === 0).slice(0, 4)) {
        const messages = await getJson<{ id: string; content: string; timestamp: string; author?: { username?: string } }[]>(
          `https://discord.com/api/v10/channels/${ch.id}/messages?limit=15`,
          { headers: { Authorization: `Bot ${token}` } },
        );
        for (const m of messages) {
          if (ctx.query && !m.content.toLowerCase().includes(ctx.query.toLowerCase())) continue;
          out.push({
            source: "DISCORD",
            externalId: m.id,
            url: `https://discord.com/channels/${g.id}/${ch.id}/${m.id}`,
            content: m.content,
            authorName: m.author?.username,
            publishedAt: new Date(m.timestamp),
            kind: "message",
          });
        }
      }
    }
    return out;
  },
  async publish(input) {
    const token = env("DISCORD_BOT_TOKEN");
    if (!token || !input.accountExternalId) throw new Error("Discord publishing requires a bot token and channel id");
    const res = await postJson<{ id: string }>(
      `https://discord.com/api/v10/channels/${input.accountExternalId}/messages`,
      { content: input.content },
      { Authorization: `Bot ${token}` },
    );
    return { externalId: res.id };
  },
};

export const twitchConnector: Connector = {
  id: "TWITCH",
  name: "Twitch",
  family: "Twitch",
  docsUrl: "https://dev.twitch.tv/docs/api/",
  keyless: false,
  capabilities: [],
  isConfigured: () => Boolean(env("TWITCH_CLIENT_ID") && env("TWITCH_CLIENT_SECRET")),
  async search(ctx) {
    const id = env("TWITCH_CLIENT_ID");
    const secret = env("TWITCH_CLIENT_SECRET");
    if (!id || !secret) return [];
    const token = await getJson<{ access_token: string }>(
      `https://id.twitch.tv/oauth2/token?client_id=${id}&client_secret=${secret}&grant_type=client_credentials`,
      { method: "POST" },
    );
    const headers = { "Client-Id": id, Authorization: `Bearer ${token.access_token}` };
    const data = await getJson<{ data?: { id: string; title?: string; user_name?: string; started_at?: string; viewer_count?: number; url?: string }[] }>(
      `https://api.twitch.tv/helix/search/channels?query=${encodeURIComponent(ctx.query)}&first=15`,
      { headers },
    );
    return (data.data ?? []).map((s) => ({
      source: "TWITCH" as const,
      externalId: s.id,
      url: s.url || `https://www.twitch.tv/${s.user_name}`,
      title: s.title,
      content: s.title ?? "",
      authorName: s.user_name,
      authorHandle: s.user_name,
      publishedAt: s.started_at ? new Date(s.started_at) : new Date(),
      viewCount: s.viewer_count ?? 0,
      reach: s.viewer_count ?? 0,
      kind: "stream",
    }));
  },
};

export const snapchatConnector: Connector = {
  id: "SNAPCHAT",
  name: "Snapchat",
  family: "Snap",
  docsUrl: "https://developers.snap.com/",
  keyless: false,
  capabilities: [],
  isConfigured: () => Boolean(env("SNAPCHAT_CLIENT_ID")),
  async search() {
    return [];
  },
  async publish(input) {
    if (!input.accessToken) throw new Error("Snapchat publishing requires Marketing API OAuth");
    const res = await postJson<{ id?: string }>(
      "https://adsapi.snapchat.com/v1/me/public_profiles",
      { text: input.content },
      { Authorization: `Bearer ${input.accessToken}` },
    );
    return { externalId: res.id ?? "snap" };
  },
};
