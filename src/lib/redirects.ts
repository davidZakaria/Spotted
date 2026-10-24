import { NextResponse } from "next/server";
import { absoluteUrl } from "./urls";

/** Redirect using APP_URL / NEXT_PUBLIC_APP_URL, never the incoming request host. */
export function redirectTo(path: string, status = 303) {
  return NextResponse.redirect(absoluteUrl(path), status);
}

export function authRedirects() {
  return {
    afterLogin: absoluteUrl("/app"),
    afterSignup: absoluteUrl("/app"),
    afterLogout: absoluteUrl("/"),
    loginError: (message: string) => absoluteUrl(`/login?error=${encodeURIComponent(message)}`),
    signupError: (message: string) => absoluteUrl(`/signup?error=${encodeURIComponent(message)}`),
    oauthAccounts: (query = "") => absoluteUrl(`/app/settings/platforms${query}`),
  };
}
