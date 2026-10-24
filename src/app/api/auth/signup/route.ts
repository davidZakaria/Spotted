import { signupUser } from "@/lib/auth";
import { redirectTo } from "@/lib/redirects";

export async function POST(req: Request) {
  const form = await req.formData();
  try {
    await signupUser({
      name: String(form.get("name") ?? ""),
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? ""),
      workspaceName: String(form.get("workspaceName") ?? "My brand"),
      locale: String(form.get("locale") ?? "en"),
    });
    return redirectTo("/app");
  } catch (error) {
    const message = error instanceof Error ? error.message : "We could not create your account.";
    return redirectTo(`/signup?error=${encodeURIComponent(message)}`);
  }
}
