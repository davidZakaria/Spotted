import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, LegalSection } from "@/components/public-shell";

export const metadata: Metadata = {
  title: "Privacy policy — Spotted",
  description: "How Spotted collects, uses, and protects your information. Written in plain language.",
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy policy"
      updated="October 25, 2026"
      lead="This page explains, in everyday words, what Spotted collects and why. We do not sell your data."
    >
      <LegalSection title="Who we are">
        <p>
          Spotted is a brand-listening app. You tell us your brand and a few words to watch. We look for public posts
          about them and help you reply or publish from one place.
        </p>
        <p>
          Questions about privacy:{" "}
          <a className="text-accent underline-offset-2 hover:underline" href="mailto:davidsamii97@gmail.com">
            davidsamii97@gmail.com
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection title="What we collect">
        <p>We only collect what we need to run your account:</p>
        <ul className="list-disc space-y-1 ps-5">
          <li>Your name, email, and password (the password is stored as a secure hash, not as plain text).</li>
          <li>Your brand name, watch words, and optional competitor names.</li>
          <li>Public posts that mention those words — author name, text, link, and the site they came from.</li>
          <li>If you connect a platform (for example Facebook or Instagram), the account name and the access we need to read or post for you.</li>
          <li>Basic usage such as when you signed in, so we can keep the service working.</li>
        </ul>
      </LegalSection>

      <LegalSection title="If you connect Facebook or Instagram">
        <p>
          When you tap Connect, Meta (Facebook) asks you to allow Spotted to see Pages or Instagram accounts you manage.
          We use that only to show comments, mentions, and messages in your Inbox, and to publish if you ask us to.
        </p>
        <p>
          We do not use Facebook data to advertise to you. We do not give it to other companies to advertise to anyone else.
          You can disconnect the account in Connected platforms at any time, and you can ask us to delete it — see{" "}
          <Link href="/data-deletion" className="text-accent underline-offset-2 hover:underline">
            Delete my data
          </Link>
          .
        </p>
      </LegalSection>

      <LegalSection title="How we use it">
        <ul className="list-disc space-y-1 ps-5">
          <li>To show you mentions, mood, and charts for your brand.</li>
          <li>To send alerts you asked for (email or Slack).</li>
          <li>To publish or reply when you click the button.</li>
          <li>To keep the product secure and fix problems.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Who we share with">
        <p>
          We do not sell personal information. We share data only when we have to: with the platforms you connect
          (so a reply can be posted), with email or Slack if you set up an alert, or if the law requires it.
        </p>
      </LegalSection>

      <LegalSection title="How long we keep it">
        <p>
          We keep your account and mentions while you use Spotted. If you ask us to delete your data, we remove your
          account, connected tokens, and stored mentions. Public posts still exist on the original site — we cannot
          delete someone else’s Reddit or news article.
        </p>
      </LegalSection>

      <LegalSection title="Your choices">
        <p>
          You can update your brand and watch words, disconnect a platform, or email us to delete everything we hold.
          Details are on the{" "}
          <Link href="/data-deletion" className="text-accent underline-offset-2 hover:underline">
            data deletion
          </Link>{" "}
          page.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
