import { requireSession } from "@/lib/auth";
import { Shell } from "@/components/shell";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  return <Shell session={session}>{children}</Shell>;
}
