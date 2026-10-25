"use client";

/** Full-page navigation. Same-origin anchors to /api/* are intercepted by the App Router and never hit the server. */
export function ConnectButton({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  return (
    <button
      type="button"
      className="rounded-xl bg-accent px-3 py-1.5 text-xs font-semibold text-accent-ink"
      onClick={() => {
        window.location.assign(href);
      }}
    >
      {label}
    </button>
  );
}
