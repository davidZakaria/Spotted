import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isSealedSecret, openSecret, redactSecrets, sealSecret } from "@/lib/crypto";
import { csrfAllowed } from "@/lib/csrf";
import { signupModeFrom } from "@/lib/signup-mode";
import { assertSameWorkspace, AuthzError } from "@/lib/authz";
import { validatePassword } from "@/lib/password";
import { generateTotp, generateTotpSecret, verifyTotp } from "@/lib/totp";
import { securityHeaders } from "@/lib/security-headers";
import { parsePublishedAt } from "@/lib/listen/dates";

process.env.ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");

describe("token encryption", () => {
  it("round-trips AES-256-GCM and leaves plaintext until migrated", () => {
    const sealed = sealSecret("page-token-plain");
    expect(sealed).toMatch(/^enc:v1:/);
    expect(isSealedSecret(sealed)).toBe(true);
    expect(openSecret(sealed)).toBe("page-token-plain");
    expect(openSecret("legacy-plain")).toBe("legacy-plain");
    expect(sealSecret(sealed)).toBe(sealed);
    expect(redactSecrets({ accessToken: "x", provider: "meta" })).toEqual({ provider: "meta" });
  });
});

describe("passwords and TOTP", () => {
  it("rejects weak passwords and verifies TOTP with clock drift", () => {
    expect(validatePassword("short")).toBeTruthy();
    expect(validatePassword("nouppercase1!")).toBeTruthy();
    expect(validatePassword("GoodPassword1!")).toBeNull();
    const secret = generateTotpSecret();
    const code = generateTotp(secret);
    expect(verifyTotp(secret, code)).toBe(true);
    expect(verifyTotp(secret, "000000")).toBe(false);
  });
});

describe("signup mode and CSRF", () => {
  it("closes sign-up once an owner exists unless SIGNUP_MODE is set", () => {
    expect(signupModeFrom({ ownerExists: false })).toBe("open");
    expect(signupModeFrom({ ownerExists: true })).toBe("closed");
    expect(signupModeFrom({ envMode: "invite", ownerExists: true })).toBe("invite");
    expect(signupModeFrom({ envMode: "open", ownerExists: true })).toBe("open");
  });

  it("allows safe methods and same-origin POSTs, rejects cross-origin", () => {
    expect(csrfAllowed({ method: "GET", pathname: "/app", allowedOrigins: ["http://localhost:4721"] })).toBe(true);
    expect(
      csrfAllowed({
        method: "POST",
        pathname: "/api/auth/login",
        origin: "http://localhost:4721",
        allowedOrigins: ["http://localhost:4721"],
      }),
    ).toBe(true);
    expect(
      csrfAllowed({
        method: "POST",
        pathname: "/api/auth/login",
        origin: "https://evil.example",
        allowedOrigins: ["http://localhost:4721"],
      }),
    ).toBe(false);
    expect(
      csrfAllowed({
        method: "POST",
        pathname: "/api/oauth/meta/callback",
        origin: "https://www.facebook.com",
        allowedOrigins: ["http://localhost:4721"],
      }),
    ).toBe(true);
  });
});

describe("workspace authorization", () => {
  it("rejects cross-workspace ids", () => {
    expect(() => assertSameWorkspace("ws_a", "ws_a")).not.toThrow();
    expect(() => assertSameWorkspace("ws_a", "ws_b")).toThrow(AuthzError);
  });

  it("scopes API routes by session.workspaceId", () => {
    const live = readFileSync("src/app/api/listen/live/route.ts", "utf8");
    const reports = readFileSync("src/app/api/reports/[id]/route.ts", "utf8");
    const oauth = readFileSync("src/app/api/oauth/[provider]/callback/route.ts", "utf8");
    expect(live).toMatch(/workspaceId: session\.workspaceId/);
    expect(live).toMatch(/liveSearchSchema/);
    expect(reports).toMatch(/workspaceId: session\.workspaceId/);
    expect(oauth).toMatch(/consumeOauthState/);
    expect(oauth).toMatch(/workspaceId !== session\.workspaceId/);
  });
});

describe("headers, startup, and secrets", () => {
  it("sets security headers and drops x-powered-by", () => {
    const headers = securityHeaders(false);
    expect(headers["Strict-Transport-Security"]).toMatch(/max-age=63072000/);
    expect(headers["Content-Security-Policy"]).toMatch(/frame-ancestors 'none'/);
    expect(headers["X-Frame-Options"]).toBe("DENY");
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(headers["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["Permissions-Policy"]).toMatch(/camera=\(\)/);
    const next = readFileSync("next.config.ts", "utf8");
    expect(next).toMatch(/poweredByHeader:\s*false/);
  });

  it("does not block next start with seed ingest", () => {
    const compose = readFileSync("docker-compose.yml", "utf8");
    expect(compose).toMatch(/prisma migrate deploy && node server\.js/);
    expect(compose).not.toMatch(/tsx prisma\/seed\.ts && node server\.js/);
    const seed = readFileSync("prisma/seed.ts", "utf8");
    expect(seed).toMatch(/SEED_DEMO/);
    expect(seed).not.toMatch(/ingestProject/);
    const worker = readFileSync("src/worker.ts", "utf8");
    expect(worker).toMatch(/ingest-all/);
  });

  it("does not ship secrets in example env or the client bundle entry", () => {
    const example = readFileSync(".env.example", "utf8");
    expect(example).toMatch(/ENCRYPTION_KEY=/);
    expect(example).toMatch(/SEED_DEMO=false/);
    expect(example).toMatch(/SIGNUP_MODE=/);
    expect(example).not.toMatch(/sk-live|EAAG|Bearer [A-Za-z0-9._-]{20,}/);
    expect(parsePublishedAt("3 days ago", new Date("2026-10-25T12:00:00Z")).toISOString()).toBe(
      "2026-10-22T12:00:00.000Z",
    );
  });
});
