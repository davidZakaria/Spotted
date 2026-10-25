import { headers } from "next/headers";
import { clientIp } from "./rate-limit";

export async function requestMeta() {
  const h = await headers();
  return {
    ip: clientIp(h),
    userAgent: h.get("user-agent"),
  };
}
