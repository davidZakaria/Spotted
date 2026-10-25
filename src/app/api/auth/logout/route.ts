import { destroySession, getSession } from "@/lib/auth";
import { redirectTo } from "@/lib/redirects";
import { writeAudit } from "@/lib/audit";
import { clientIp } from "@/lib/rate-limit";

export async function POST(req: Request) {
  const session = await getSession();
  await destroySession();
  if (session) {
    await writeAudit({
      action: "logout",
      userId: session.id,
      workspaceId: session.workspaceId,
      ip: clientIp(req.headers),
      userAgent: req.headers.get("user-agent"),
    });
  }
  return redirectTo("/");
}
