import { NextResponse, type NextRequest } from "next/server";

function publicBase() {
  const raw = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "http://127.0.0.1:4721";
  return raw.replace(/\/$/, "");
}

export function middleware(req: NextRequest) {
  const session = req.cookies.get("spotted_session")?.value;
  if (!session) {
    const next = req.nextUrl.pathname;
    return NextResponse.redirect(`${publicBase()}/login?next=${encodeURIComponent(next)}`);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/app/:path*"],
};
