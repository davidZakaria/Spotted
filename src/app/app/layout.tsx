import { requireSession } from "@/lib/auth";
import { getTheme } from "@/lib/theme";
import { Shell } from "@/components/shell";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  const theme = await getTheme();
  return <Shell session={session} theme={theme}>{children}</Shell>;
}
