import { NextResponse, type NextRequest } from "next/server";
import { isPublicPath } from "@/lib/public-paths";
import { applySecurityHeaders } from "@/lib/security-headers";
import { configuredOrigins, csrfAllowed } from "@/lib/csrf";

function publicBase() {
  const raw = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "http://127.0.0.1:4721";
  return raw.replace(/\/$/, "");
}

export function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const headers = new Headers();
  applySecurityHeaders(headers, process.env.NODE_ENV !== "production");

  const allowedOrigins = configuredOrigins([req.nextUrl.origin]);
  if (
    !csrfAllowed({
      method: req.method,
      origin: req.headers.get("origin"),
      referer: req.headers.get("referer"),
      pathname: path,
      allowedOrigins,
    })
  ) {
    const denied = new NextResponse("Invalid request origin", { status: 403, headers });
    return denied;
  }

  if (path.startsWith("/app") && !isPublicPath(path)) {
    const session = req.cookies.get("spotted_session")?.value;
    if (!session) {
      const redirect = NextResponse.redirect(`${publicBase()}/login?next=${encodeURIComponent(path)}`);
      applySecurityHeaders(redirect.headers, process.env.NODE_ENV !== "production");
      return redirect;
    }
  }

  const res = NextResponse.next({ request: { headers: req.headers } });
  applySecurityHeaders(res.headers, process.env.NODE_ENV !== "production");
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
