import { loginUser } from "@/lib/auth";
import { redirectTo } from "@/lib/redirects";

export async function POST(req: Request) {
  const form = await req.formData();
  try {
    await loginUser(String(form.get("email") ?? ""), String(form.get("password") ?? ""));
    return redirectTo("/app");
  } catch (error) {
    const message = error instanceof Error ? error.message : "We could not sign you in. Check your email and password.";
    return redirectTo(`/login?error=${encodeURIComponent(message)}`);
  }
}
