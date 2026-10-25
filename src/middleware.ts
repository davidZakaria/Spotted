import { NextResponse, type NextRequest } from "next/server";
import { isPublicPath } from "@/lib/public-paths";

function publicBase() {
  const raw = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "http://127.0.0.1:4721";
  return raw.replace(/\/$/, "");
}

export function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  if (isPublicPath(path)) {
    return NextResponse.next();
  }
  const session = req.cookies.get("spotted_session")?.value;
  if (!session) {
    return NextResponse.redirect(`${publicBase()}/login?next=${encodeURIComponent(path)}`);
  }
  return NextResponse.next();
}

export const config = {
  // Only the signed-in product is gated. Legal pages stay off this list so Meta’s crawler can read them.
  matcher: ["/app/:path*"],
};
