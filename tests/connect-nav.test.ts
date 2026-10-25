import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Connect navigation", () => {
  it("forces a full-page assign so the App Router cannot swallow /api/oauth clicks", () => {
    const button = readFileSync(resolve("src/components/connect-button.tsx"), "utf8");
    expect(button).toMatch(/window\.location\.assign/);
    expect(button).toMatch(/<button/);
    expect(button).not.toMatch(/<a[\s>]/);
  });

  it("platforms page uses ConnectButton, honest badges, and oauth error copy", () => {
    const page = readFileSync(resolve("src/app/app/settings/platforms/page.tsx"), "utf8");
    expect(page).toMatch(/ConnectButton/);
    expect(page).toMatch(/describeConnection/);
    expect(page).toMatch(/oauthErrorCopy/);
    expect(page).not.toMatch(/status\?\.configured \|\| connected/);
    expect(page).not.toMatch(/<a href=\{OAUTH/);
  });

  it("help modal also uses ConnectButton", () => {
    const help = readFileSync(resolve("src/components/connect-help.tsx"), "utf8");
    expect(help).toMatch(/ConnectButton/);
    expect(help).not.toMatch(/<a href=\{connectHref/);
  });

  it("oauth start logs and never uses requireSession navigation in a route handler", () => {
    const start = readFileSync(resolve("src/app/api/oauth/[provider]/route.ts"), "utf8");
    expect(start).toMatch(/getSession/);
    expect(start).not.toMatch(/requireSession/);
    expect(start).toMatch(/logOauth/);
    expect(start).toMatch(/missing_meta_keys/);
    expect(start).toMatch(/metaAuthorizeUrl/);
    const callback = readFileSync(resolve("src/app/api/oauth/[provider]/callback/route.ts"), "utf8");
    expect(callback).toMatch(/exchangeMetaUserToken/);
    expect(callback).toMatch(/listManagedPages/);
    expect(callback).toMatch(/socialRowsFromPages/);
    expect(callback).toMatch(/logOauth/);
  });
});
