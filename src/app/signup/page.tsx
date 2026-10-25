import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { BrandMark } from "@/components/brand";
import { SiteFooter } from "@/components/site-footer";
import { prisma } from "@/lib/db";
import { resolveSignupMode } from "@/lib/signup-mode";
import { PASSWORD_MIN_LENGTH } from "@/lib/password";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; invite?: string }>;
}) {
  if (await getSession()) redirect("/app");
  const { error, invite: inviteToken } = await searchParams;
  const mode = await resolveSignupMode();
  const invite = inviteToken
    ? await prisma.invite.findUnique({ where: { token: inviteToken }, include: { workspace: true } })
    : null;
  const inviteValid = Boolean(invite && !invite.acceptedAt && invite.expiresAt > new Date());
  const closed = (mode === "closed" || mode === "invite") && !inviteValid;

  return (
    <div className="grid min-h-screen place-items-center px-4 py-10">
      <div className="w-full max-w-md space-y-6">
      <form action="/api/auth/signup" method="post" className="card w-full space-y-4 p-8">
        <BrandMark />
        <div>
          <h1 className="mt-3 text-2xl font-semibold">
            {inviteValid ? `Join ${invite?.workspace.name}` : "Create your account"}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {closed
              ? "Sign-up is closed. Ask an owner to email you an invite."
              : inviteValid
                ? "Use the email this invite was sent to, then pick a strong password."
                : "A short setup follows: name your brand, pick words to watch, and see first results."}
          </p>
        </div>
        {error ? <p className="rounded-xl bg-bad/10 px-3 py-2 text-sm text-bad">{error}</p> : null}
        {closed ? (
          <p className="text-center text-sm text-muted">
            Already have one? <Link href="/login" className="text-accent">Sign in</Link>
          </p>
        ) : (
          <>
            {inviteValid ? <input type="hidden" name="invite" value={inviteToken} /> : null}
            <label className="block text-sm">Your name<input name="name" required className="mt-1" placeholder="Dana" /></label>
            <label className="block text-sm">
              Work email
              <input name="email" type="email" required className="mt-1" defaultValue={invite?.email ?? ""} />
            </label>
            <label className="block text-sm">
              Password
              <input name="password" type="password" required minLength={PASSWORD_MIN_LENGTH} className="mt-1" />
              <span className="mt-1 block text-xs text-muted">
                At least {PASSWORD_MIN_LENGTH} characters, with upper and lower case, a number, and a symbol.
              </span>
            </label>
            {inviteValid ? null : (
              <label className="block text-sm">Company or brand name<input name="workspaceName" required defaultValue="Acme" className="mt-1" /></label>
            )}
            <label className="block text-sm">
              Language
              <select name="locale" className="mt-1" defaultValue="en">
                <option value="en">English</option>
                <option value="ar">العربية</option>
              </select>
            </label>
            <button className="w-full rounded-xl bg-accent py-2.5 text-sm font-semibold text-accent-ink">Create account</button>
            <p className="text-center text-sm text-muted">
              Already have one? <Link href={inviteToken ? `/login?invite=${inviteToken}` : "/login"} className="text-accent">Sign in</Link>
            </p>
          </>
        )}
      </form>
      <SiteFooter compact />
      </div>
    </div>
  );
}
