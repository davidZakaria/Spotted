import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, LegalSection } from "@/components/public-shell";

export const metadata: Metadata = {
  title: "Terms of service — Spotted",
  description: "The simple rules for using Spotted. Written in plain language.",
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of service"
      updated="October 25, 2026"
      lead="These are the house rules for using Spotted. If something is unclear, email us and we will explain it in ordinary words."
    >
      <LegalSection title="What Spotted is">
        <p>
          Spotted helps you see public conversation about your brand and reply from one place. It is a tool for
          marketing teams, not a law firm, bank, or newsroom.
        </p>
      </LegalSection>

      <LegalSection title="Your account">
        <p>
          You need an email and password to use the app. Keep them private. You are responsible for what happens on
          your account, including posts you schedule.
        </p>
        <p>You must be old enough to agree to these terms in your country (at least 18 in most places).</p>
      </LegalSection>

      <LegalSection title="Using the product fairly">
        <ul className="list-disc space-y-1 ps-5">
          <li>Watch your own brand and public conversation. Do not use Spotted to harass people.</li>
          <li>Follow the rules of every site you connect (Facebook, Instagram, X, and the rest).</li>
          <li>Do not try to break the app, scrape it, or use it to send spam.</li>
        </ul>
      </LegalSection>

      <LegalSection title="What we can and cannot promise">
        <p>
          We look at what each platform allows. Some sites do not let apps watch competitors or search every post.
          Charts and mood labels are a helpful steer, not a perfect score. We may have downtime while we fix things.
        </p>
      </LegalSection>

      <LegalSection title="Content and platforms">
        <p>
          Mentions we show usually belong to the people who wrote them. The original site’s rules still apply. If you
          connect Facebook or another network, you also agree to that network’s terms.
        </p>
      </LegalSection>

      <LegalSection title="If you want to leave">
        <p>
          You can stop using Spotted at any time. To delete your account and the data we stored, follow{" "}
          <Link href="/data-deletion" className="text-accent underline-offset-2 hover:underline">
            Delete my data
          </Link>{" "}
          or email{" "}
          <a className="text-accent underline-offset-2 hover:underline" href="mailto:davidsamii97@gmail.com">
            davidsamii97@gmail.com
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection title="Questions">
        <p>
          Read the{" "}
          <Link href="/privacy" className="text-accent underline-offset-2 hover:underline">
            privacy policy
          </Link>{" "}
          for how we handle information. For anything else, write to{" "}
          <a className="text-accent underline-offset-2 hover:underline" href="mailto:davidsamii97@gmail.com">
            davidsamii97@gmail.com
          </a>
          .
        </p>
      </LegalSection>
    </LegalPage>
  );
}
