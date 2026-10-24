import Link from "next/link";
import { BrandMark } from "@/components/brand";

export default function HomePage() {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
        <BrandMark />
        <nav className="flex items-center gap-3 text-sm">
          <Link href="/login" className="text-muted hover:text-ink">Sign in</Link>
          <Link href="/signup" className="rounded-xl bg-accent px-3 py-2 font-medium text-bg">Create workspace</Link>
        </nav>
      </header>
      <main className="mx-auto w-full max-w-6xl px-6 pb-24 pt-10">
        <p className="text-xs uppercase tracking-[0.2em] text-accent">Spotted everywhere</p>
        <h1 className="mt-4 max-w-3xl text-5xl font-semibold leading-[1.1] tracking-tight">
          Hear every mention. Reply from one inbox. Publish on a calendar.
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-muted">
          Spotted watches Reddit, Hacker News, Google News, Bluesky, Mastodon, RSS, and every major network your keys unlock — then scores sentiment, including Arabic, and lets you schedule the response.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/signup" className="rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-bg">Start a listening project</Link>
          <Link href="/login" className="rounded-xl border border-line px-5 py-3 text-sm">Use the demo workspace</Link>
        </div>
        <div className="mt-14 grid gap-4 md:grid-cols-3">
          {[
            ["Listening", "Keyword, hashtag, public account, and competitor tracking — with honest labels when a platform’s API forbids it."],
            ["Analytics", "Volume, reach, sentiment, share of voice, top authors, languages, and Google Trends interest."],
            ["Publishing", "OAuth accounts, a content calendar, unified inbox, and mock scheduling when no token is connected."],
          ].map(([title, body]) => (
            <div key={title} className="card p-5">
              <h2 className="font-semibold">{title}</h2>
              <p className="mt-2 text-sm text-muted">{body}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
