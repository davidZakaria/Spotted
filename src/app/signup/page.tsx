import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

export default async function SignupPage() {
  if (await getSession()) redirect("/app");
  return (
    <div className="grid min-h-screen place-items-center px-4">
      <form action="/api/auth/signup" method="post" className="card w-full max-w-md space-y-4 p-8">
        <div>
          <p className="text-xs uppercase tracking-widest text-accent">Aether</p>
          <h1 className="mt-1 text-2xl font-semibold">Create a workspace</h1>
          <p className="mt-1 text-sm text-muted">Multi-tenant from the first account. Invite teammates later.</p>
        </div>
        <label className="block text-sm">Your name<input name="name" required className="mt-1" /></label>
        <label className="block text-sm">Work email<input name="email" type="email" required className="mt-1" /></label>
        <label className="block text-sm">Password<input name="password" type="password" required minLength={8} className="mt-1" /></label>
        <label className="block text-sm">Workspace name<input name="workspaceName" required defaultValue="Acme Labs" className="mt-1" /></label>
        <label className="block text-sm">
          Interface language
          <select name="locale" className="mt-1" defaultValue="en">
            <option value="en">English</option>
            <option value="ar">العربية</option>
          </select>
        </label>
        <button className="w-full rounded-xl bg-accent py-2.5 text-sm font-semibold text-bg">Create workspace</button>
        <p className="text-center text-sm text-muted">
          Already have one? <Link href="/login" className="text-accent">Sign in</Link>
        </p>
      </form>
    </div>
  );
}
