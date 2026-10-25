import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { BrandMark } from "@/components/brand";
import { SiteFooter } from "@/components/site-footer";
import { appConfig } from "@/lib/config";
import { resolveSignupMode } from "@/lib/signup-mode";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; invite?: string }>;
}) {
  if (await getSession()) redirect("/app");
  const { error, invite } = await searchParams;
  const mode = await resolveSignupMode();
  const showDemo = appConfig.seedDemo;
  return (
    <div className="grid min-h-screen place-items-center px-4 py-10">
      <div className="w-full max-w-md space-y-6">
      <form action="/api/auth/login" method="post" className="card w-full space-y-4 p-8">
        <BrandMark />
        <div>
          <h1 className="mt-3 text-2xl font-semibold">Sign in</h1>
          <p className="mt-1 text-sm text-muted">See what people are saying about your brand.</p>
          {showDemo ? <p className="mt-2 text-sm text-muted">Local demo: demo@spotted.app / demo1234</p> : null}
        </div>
        {error ? <p className="rounded-xl bg-bad/10 px-3 py-2 text-sm text-bad">{error}</p> : null}
        <label className="block text-sm">
          Work email
          <input name="email" type="email" required defaultValue={showDemo ? "demo@spotted.app" : ""} className="mt-1" />
        </label>
        <label className="block text-sm">
          Password
          <input name="password" type="password" required defaultValue={showDemo ? "demo1234" : ""} className="mt-1" />
        </label>
        <button className="w-full rounded-xl bg-accent py-2.5 text-sm font-semibold text-accent-ink">Continue</button>
        <p className="text-center text-sm text-muted">
          {mode === "closed" && !invite
            ? "New accounts are invite-only. Ask an owner to send you a link."
            : (
              <>
                New here?{" "}
                <Link href={invite ? `/signup?invite=${invite}` : "/signup"} className="text-accent">
                  Create an account
                </Link>
              </>
            )}
        </p>
      </form>
      <SiteFooter compact />
      </div>
    </div>
  );
}
