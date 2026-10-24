import { NextResponse } from "next/server";
import { signupUser } from "@/lib/auth";

export async function POST(req: Request) {
  const form = await req.formData();
  try {
    await signupUser({
      name: String(form.get("name") ?? ""),
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? ""),
      workspaceName: String(form.get("workspaceName") ?? "Workspace"),
      locale: String(form.get("locale") ?? "en"),
    });
    return NextResponse.redirect(new URL("/app", req.url), 303);
  } catch (error) {
    return NextResponse.redirect(new URL(`/signup?error=${encodeURIComponent(error instanceof Error ? error.message : "Signup failed")}`, req.url), 303);
  }
}
