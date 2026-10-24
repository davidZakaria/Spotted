import { destroySession } from "@/lib/auth";
import { redirectTo } from "@/lib/redirects";

export async function POST() {
  await destroySession();
  return redirectTo("/");
}
