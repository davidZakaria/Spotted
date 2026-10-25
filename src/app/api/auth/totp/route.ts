import { completeTotpLogin } from "@/lib/auth";
import { redirectTo } from "@/lib/redirects";
import { consumeRateLimit, clientIp, rateLimitResponse } from "@/lib/rate-limit";
import { writeAudit } from "@/lib/audit";

export async function POST(req: Request) {
  const ip = clientIp(req.headers);
  const limit = await consumeRateLimit({ key: `totp:ip:${ip}`, limit: 15, windowSec: 15 * 60, failClosed: true });
  if (!limit.allowed) return rateLimitResponse(limit);
  const form = await req.formData();
  const code = String(form.get("totp") ?? "").replace(/\s+/g, "");
  try {
    const user = await completeTotpLogin(code);
    await writeAudit({
      action: "login.success",
      userId: user.id,
      ip,
      userAgent: req.headers.get("user-agent"),
      metadata: { totp: true },
    });
    return redirectTo("/app");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid authentication code";
    await writeAudit({ action: "login.failure", ip, metadata: { totp: true } });
    return redirectTo(`/login/totp?error=${encodeURIComponent(message)}`);
  }
}
