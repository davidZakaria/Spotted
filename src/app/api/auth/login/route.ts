import { NextResponse } from "next/server";
import { loginUser } from "@/lib/auth";

export async function POST(req: Request) {
  const form = await req.formData();
  try {
    await loginUser(String(form.get("email") ?? ""), String(form.get("password") ?? ""));
    return NextResponse.redirect(new URL("/app", req.url), 303);
  } catch (error) {
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error instanceof Error ? error.message : "Login failed")}`, req.url), 303);
  }
}
