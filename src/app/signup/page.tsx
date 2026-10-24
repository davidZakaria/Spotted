import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { BrandMark } from "@/components/brand";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (await getSession()) redirect("/app");
  const { error } = await searchParams;
  return (
    <div className="grid min-h-screen place-items-center px-4">
      <form action="/api/auth/signup" method="post" className="card w-full max-w-md space-y-4 p-8">
        <BrandMark />
        <div>
          <h1 className="mt-3 text-2xl font-semibold">Create your account</h1>
          <p className="mt-1 text-sm text-muted">A short setup follows: name your brand, pick words to watch, and see first results.</p>
        </div>
        {error ? <p className="rounded-xl bg-bad/10 px-3 py-2 text-sm text-bad">{error}</p> : null}
        <label className="block text-sm">Your name<input name="name" required className="mt-1" placeholder="Dana" /></label>
        <label className="block text-sm">Work email<input name="email" type="email" required className="mt-1" /></label>
        <label className="block text-sm">Password<input name="password" type="password" required minLength={8} className="mt-1" /></label>
        <label className="block text-sm">Company or brand name<input name="workspaceName" required defaultValue="Acme" className="mt-1" /></label>
        <label className="block text-sm">
          Language
          <select name="locale" className="mt-1" defaultValue="en">
            <option value="en">English</option>
            <option value="ar">العربية</option>
          </select>
        </label>
        <button className="w-full rounded-xl bg-accent py-2.5 text-sm font-semibold text-accent-ink">Create account</button>
        <p className="text-center text-sm text-muted">
          Already have one? <Link href="/login" className="text-accent">Sign in</Link>
        </p>
      </form>
    </div>
  );
}
