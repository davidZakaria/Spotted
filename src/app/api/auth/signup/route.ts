import { signupUser } from "@/lib/auth";
import { redirectTo } from "@/lib/redirects";
import { signupSchema } from "@/lib/validation";
import { consumeRateLimit, clientIp, rateLimitResponse } from "@/lib/rate-limit";
import { writeAudit } from "@/lib/audit";

export async function POST(req: Request) {
  const ip = clientIp(req.headers);
  const limit = await consumeRateLimit({ key: `signup:ip:${ip}`, limit: 8, windowSec: 60 * 60, failClosed: true });
  if (!limit.allowed) return rateLimitResponse(limit);

  const form = await req.formData();
  const parsed = signupSchema.safeParse({
    name: String(form.get("name") ?? ""),
    email: String(form.get("email") ?? ""),
    password: String(form.get("password") ?? ""),
    workspaceName: String(form.get("workspaceName") ?? "My brand"),
    locale: String(form.get("locale") ?? "en"),
    invite: String(form.get("invite") ?? ""),
  });
  if (!parsed.success) {
    return redirectTo(`/signup?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Check the form and try again.")}`);
  }
  try {
    const result = await signupUser({
      name: parsed.data.name,
      email: parsed.data.email,
      password: parsed.data.password,
      workspaceName: parsed.data.workspaceName,
      locale: parsed.data.locale,
      invite: parsed.data.invite,
    });
    await writeAudit({
      action: parsed.data.invite ? "invite.accept" : "signup",
      userId: result.user.id,
      workspaceId: "workspace" in result && result.workspace ? result.workspace.id : result.workspaceId,
      ip,
      userAgent: req.headers.get("user-agent"),
      metadata: { email: parsed.data.email.toLowerCase() },
    });
    return redirectTo("/app");
  } catch (error) {
    const message = error instanceof Error ? error.message : "We could not create your account.";
    return redirectTo(`/signup?error=${encodeURIComponent(message)}`);
  }
}
