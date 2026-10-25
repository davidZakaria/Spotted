import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { BrandMark } from "@/components/brand";
import { SiteFooter } from "@/components/site-footer";

export default async function TotpPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (await getSession()) redirect("/app");
  const { error } = await searchParams;
  return (
    <div className="grid min-h-screen place-items-center px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        <form action="/api/auth/totp" method="post" className="card w-full space-y-4 p-8">
          <BrandMark />
          <div>
            <h1 className="mt-3 text-2xl font-semibold">Authentication code</h1>
            <p className="mt-1 text-sm text-muted">Open your authenticator app and enter the 6-digit code.</p>
          </div>
          {error ? <p className="rounded-xl bg-bad/10 px-3 py-2 text-sm text-bad">{error}</p> : null}
          <label className="block text-sm">
            Code
            <input name="totp" inputMode="numeric" autoComplete="one-time-code" required pattern="\d{6}" className="mt-1" />
          </label>
          <button className="w-full rounded-xl bg-accent py-2.5 text-sm font-semibold text-accent-ink">Verify</button>
          <p className="text-center text-sm text-muted">
            <Link href="/login" className="text-accent">Back to sign in</Link>
          </p>
        </form>
        <SiteFooter compact />
      </div>
    </div>
  );
}
