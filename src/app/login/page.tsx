import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { BrandMark } from "@/components/brand";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (await getSession()) redirect("/app");
  const { error } = await searchParams;
  return (
    <div className="grid min-h-screen place-items-center px-4">
      <form action="/api/auth/login" method="post" className="card w-full max-w-md space-y-4 p-8">
        <BrandMark />
        <div>
          <h1 className="mt-3 text-2xl font-semibold">Sign in</h1>
          <p className="mt-1 text-sm text-muted">See what people are saying about your brand.</p>
          <p className="mt-2 text-sm text-muted">Try the demo: demo@spotted.app / demo1234</p>
        </div>
        {error ? <p className="rounded-xl bg-bad/10 px-3 py-2 text-sm text-bad">{error}</p> : null}
        <label className="block text-sm">
          Work email
          <input name="email" type="email" required defaultValue="demo@spotted.app" className="mt-1" />
        </label>
        <label className="block text-sm">
          Password
          <input name="password" type="password" required defaultValue="demo1234" className="mt-1" />
        </label>
        <button className="w-full rounded-xl bg-accent py-2.5 text-sm font-semibold text-accent-ink">Continue</button>
        <p className="text-center text-sm text-muted">
          New here? <Link href="/signup" className="text-accent">Create an account</Link>
        </p>
      </form>
    </div>
  );
}
