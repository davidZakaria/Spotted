import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

export default async function LoginPage() {
  if (await getSession()) redirect("/app");
  return (
    <div className="grid min-h-screen place-items-center px-4">
      <form action="/api/auth/login" method="post" className="card w-full max-w-md space-y-4 p-8">
        <div>
          <p className="text-xs uppercase tracking-widest text-accent">Aether</p>
          <h1 className="mt-1 text-2xl font-semibold">Sign in</h1>
          <p className="mt-1 text-sm text-muted">Demo: demo@aether.app / demo1234</p>
        </div>
        <label className="block text-sm">
          Email
          <input name="email" type="email" required defaultValue="demo@aether.app" className="mt-1" />
        </label>
        <label className="block text-sm">
          Password
          <input name="password" type="password" required defaultValue="demo1234" className="mt-1" />
        </label>
        <button className="w-full rounded-xl bg-accent py-2.5 text-sm font-semibold text-bg">Continue</button>
        <p className="text-center text-sm text-muted">
          New here? <Link href="/signup" className="text-accent">Create a workspace</Link>
        </p>
      </form>
    </div>
  );
}
