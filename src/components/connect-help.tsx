"use client";

import { useState } from "react";
import type { PlatformInfo } from "@/lib/platforms";
import { Button } from "@/components/ui";
import { ConnectButton } from "@/components/connect-button";
import { PlatformLogo } from "@/components/platform-logo";

export function ConnectHelp({
  platform,
  locale,
  connectHref,
}: {
  platform: PlatformInfo;
  locale: string;
  connectHref?: string;
}) {
  const [open, setOpen] = useState(false);
  const ar = locale === "ar";
  const name = ar ? platform.nameAr : platform.name;
  const steps = ar ? platform.stepsAr : platform.steps;
  const hint = ar ? platform.connectHintAr : platform.connectHint;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-xl border border-line px-3 py-1.5 text-xs font-medium hover:bg-bg-soft"
      >
        {ar ? "كيف أربط؟" : "How to connect"}
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={() => setOpen(false)}>
          <div
            className="card w-full max-w-lg p-6"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center gap-3">
              <PlatformLogo id={platform.id} size={36} />
              <div>
                <h2 className="text-lg font-semibold">{ar ? `اربط ${name}` : `Connect ${name}`}</h2>
                <p className="text-sm text-muted">{hint}</p>
              </div>
            </div>
            <ol className="mt-4 list-decimal space-y-2 ps-5 text-sm">
              {steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            <div className="mt-5 flex flex-wrap gap-2">
              {connectHref ? <ConnectButton href={connectHref} label={ar ? "ابدأ الربط" : "Start connecting"} /> : null}
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                {ar ? "إغلاق" : "Close"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
