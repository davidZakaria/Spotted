import { loginUser, NeedsTotpError, setPendingTotp } from "@/lib/auth";
import { redirectTo } from "@/lib/redirects";
import { loginSchema } from "@/lib/validation";
import { consumeRateLimit, clientIp, rateLimitResponse } from "@/lib/rate-limit";
import { writeAudit } from "@/lib/audit";

export async function POST(req: Request) {
  const ip = clientIp(req.headers);
  const ipLimit = await consumeRateLimit({ key: `login:ip:${ip}`, limit: 20, windowSec: 15 * 60, failClosed: true });
  if (!ipLimit.allowed) return rateLimitResponse(ipLimit);

  const form = await req.formData();
  const parsed = loginSchema.safeParse({
    email: String(form.get("email") ?? ""),
    password: String(form.get("password") ?? ""),
    totp: String(form.get("totp") ?? ""),
  });
  if (!parsed.success) {
    return redirectTo(`/login?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Check your email and password.")}`);
  }

  const emailLimit = await consumeRateLimit({
    key: `login:email:${parsed.data.email.toLowerCase()}`,
    limit: 8,
    windowSec: 15 * 60,
    failClosed: true,
  });
  if (!emailLimit.allowed) return rateLimitResponse(emailLimit);

  try {
    await loginUser(parsed.data.email, parsed.data.password, parsed.data.totp || undefined);
    await writeAudit({
      action: "login.success",
      ip,
      userAgent: req.headers.get("user-agent"),
      metadata: { email: parsed.data.email.toLowerCase() },
    });
    return redirectTo("/app");
  } catch (error) {
    if (error instanceof NeedsTotpError) {
      await setPendingTotp(error.userId);
      return redirectTo("/login/totp");
    }
    const message = error instanceof Error ? error.message : "We could not sign you in. Check your email and password.";
    await writeAudit({
      action: message.includes("locked") ? "login.lockout" : "login.failure",
      ip,
      userAgent: req.headers.get("user-agent"),
      metadata: { email: parsed.data.email.toLowerCase() },
    });
    return redirectTo(`/login?error=${encodeURIComponent(message)}`);
  }
}
