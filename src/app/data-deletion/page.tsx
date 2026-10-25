import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, LegalSection } from "@/components/public-shell";

export const metadata: Metadata = {
  title: "Delete my data — Spotted",
  description: "How to ask Spotted to delete your account and the data we hold. No login required.",
};

export default function DataDeletionPage() {
  return (
    <LegalPage
      title="Delete my data"
      updated="October 25, 2026"
      lead="You can ask us to erase your Spotted account and the data we stored. You do not need to be signed in to send the request."
    >
      <LegalSection title="How to ask">
        <p>
          Email{" "}
          <a className="text-accent underline-offset-2 hover:underline" href="mailto:davidsamii97@gmail.com">
            davidsamii97@gmail.com
          </a>{" "}
          with the subject line <strong className="text-ink">Delete my Spotted data</strong>.
        </p>
        <p>Please include:</p>
        <ul className="list-disc space-y-1 ps-5">
          <li>The email address on your Spotted account</li>
          <li>Your name</li>
          <li>Whether you also connected Facebook, Instagram, or another platform</li>
        </ul>
        <p>
          We will reply to confirm it is you, then delete the data. We aim to finish within 30 days. If we need longer,
          we will say so in the reply.
        </p>
      </LegalSection>

      <LegalSection title="What we delete">
        <ul className="list-disc space-y-1 ps-5">
          <li>Your login and workspace</li>
          <li>Brand names, watch words, alerts, and scheduled posts</li>
          <li>Mentions we stored for you</li>
          <li>Connected-account tokens (so we can no longer read or post as you)</li>
        </ul>
        <p>
          We cannot delete a public post on Reddit, Facebook, or a news site. Those stay on the original platform. We
          only delete our copy.
        </p>
      </LegalSection>

      <LegalSection title="If you connected Facebook or Instagram">
        <p>You can cut the link in two places:</p>
        <ol className="list-decimal space-y-1 ps-5">
          <li>In Spotted, open Connected platforms and disconnect the account, or email us and we will do it.</li>
          <li>
            In Facebook: Settings &rarr; Apps and websites. Find Spotted and remove it. That stops Facebook from sharing
            new data with us.
          </li>
        </ol>
        <p>Removing the app in Facebook does not automatically wipe your Spotted login. Email us if you want both gone.</p>
      </LegalSection>

      <LegalSection title="Questions">
        <p>
          Privacy details live on the{" "}
          <Link href="/privacy" className="text-accent underline-offset-2 hover:underline">
            privacy policy
          </Link>
          . Terms are on the{" "}
          <Link href="/terms" className="text-accent underline-offset-2 hover:underline">
            terms of service
          </Link>
          . Same inbox for both:{" "}
          <a className="text-accent underline-offset-2 hover:underline" href="mailto:davidsamii97@gmail.com">
            davidsamii97@gmail.com
          </a>
          .
        </p>
      </LegalSection>
    </LegalPage>
  );
}
