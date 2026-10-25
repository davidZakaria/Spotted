import Link from "next/link";
import { PublicShell } from "@/components/public-shell";

export default function HomePage() {
  return (
    <PublicShell>
      <main className="mx-auto w-full max-w-6xl px-6 pb-16 pt-10">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-accent">For marketing teams</p>
        <h1 className="mt-4 max-w-3xl text-5xl font-semibold leading-[1.1] tracking-tight">
          See every mention of your brand — then reply from one place.
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-muted">
          Spotted watches public conversation, shows whether people sound happy or upset, and lets you publish without hopping between apps.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/signup" className="rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-accent-ink">Start free setup</Link>
          <Link href="/login" className="rounded-xl border border-line px-5 py-3 text-sm">Try the demo</Link>
        </div>
        <div className="mt-14 grid gap-4 md:grid-cols-3">
          {[
            ["Listen", "Tell us your brand and a few words. We find posts on sites that work immediately, then more after you connect them."],
            ["Understand", "Home says how many mentions arrived today and whether the mood is mostly positive."],
            ["Act", "Reply in Inbox, schedule a post, or get an email when conversation suddenly jumps."],
          ].map(([title, body]) => (
            <div key={title} className="card p-5">
              <h2 className="font-semibold">{title}</h2>
              <p className="mt-2 text-sm text-muted">{body}</p>
            </div>
          ))}
        </div>
      </main>
    </PublicShell>
  );
}
