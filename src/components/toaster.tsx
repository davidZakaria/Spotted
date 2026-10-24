"use client";

import { Toaster as Sonner } from "sonner";

export function Toaster() {
  return (
    <Sonner
      theme="system"
      toastOptions={{
        className: "border border-line bg-bg-elev text-ink",
      }}
    />
  );
}
