import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { absoluteUrl, publicAppUrl } from "@/lib/urls";
import { authRedirects, redirectTo } from "@/lib/redirects";

const AUTH_ROUTES = [
  "src/app/api/auth/login/route.ts",
  "src/app/api/auth/signup/route.ts",
  "src/app/api/auth/logout/route.ts",
  "src/app/api/oauth/[provider]/route.ts",
  "src/app/api/oauth/[provider]/callback/route.ts",
  "src/middleware.ts",
];

describe("absoluteUrl", () => {
  it("uses APP_URL / NEXT_PUBLIC base, not the request host", () => {
    expect(absoluteUrl("/app", "http://127.0.0.1:4721")).toBe("http://127.0.0.1:4721/app");
    expect(absoluteUrl("/app", "https://spotted.app/")).toBe("https://spotted.app/app");
    expect(absoluteUrl("login?error=x", "https://spotted.app")).toBe("https://spotted.app/login?error=x");
  });

  it("never prefers 0.0.0.0 even if a request host looks like that", () => {
    const fromConfig = absoluteUrl("/app");
    expect(fromConfig).not.toContain("0.0.0.0");
    expect(fromConfig.endsWith("/app")).toBe(true);
    expect(publicAppUrl()).not.toContain("0.0.0.0");
  });
});

describe("auth redirects", () => {
  it("builds login, signup, and logout locations from APP_URL", () => {
    const previous = process.env.APP_URL;
    process.env.APP_URL = "https://spotted.example";
    process.env.NEXT_PUBLIC_APP_URL = "https://spotted.example";
    try {
      const redirects = authRedirects();
      expect(redirects.afterLogin).toBe("https://spotted.example/app");
      expect(redirects.afterSignup).toBe("https://spotted.example/app");
      expect(redirects.afterLogout).toBe("https://spotted.example/");
      expect(redirects.loginError("Nope")).toBe("https://spotted.example/login?error=Nope");
      expect(redirects.signupError("Taken")).toBe("https://spotted.example/signup?error=Taken");
      const response = redirectTo("/app");
      expect(response.headers.get("location")).toBe("https://spotted.example/app");
      expect(response.status).toBe(303);
      expect(response.headers.get("location")).not.toContain("0.0.0.0");
    } finally {
      if (previous == null) delete process.env.APP_URL;
      else process.env.APP_URL = previous;
      delete process.env.NEXT_PUBLIC_APP_URL;
    }
  });

  it("auth and oauth routes never redirect from the request host", () => {
    for (const file of AUTH_ROUTES) {
      const src = readFileSync(resolve(file), "utf8");
      expect(src, file).not.toMatch(/NextResponse\.redirect\(\s*new URL\([^)]*req\.url/);
      expect(src, file).not.toMatch(/req\.nextUrl\.clone\(\)/);
      expect(src).toMatch(/redirectTo|publicBase|absoluteUrl/);
    }
  });
});
