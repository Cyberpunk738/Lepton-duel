"use client";

import { useEffect, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { POT, POT_ICON } from "@/lib/content";
import { CtaButton } from "./cta-button";
import { Reveal } from "./reveal";
import { fetchOnChainPot } from "@/lib/web3";

export function PotBanner() {
  const [livePot, setLivePot] = useState<number | null>(null);

  useEffect(() => {
    // Initial fetch
    fetchOnChainPot().then((amount) => {
      setLivePot(amount > 0 ? amount : 100);
    });

    // Refresh every 15 seconds
    const interval = setInterval(() => {
      fetchOnChainPot().then((amount) => {
        setLivePot(amount > 0 ? amount : 100);
      });
    }, 15000);

    return () => clearInterval(interval);
  }, []);

  return (
    <section id="pot" className="mx-auto max-w-6xl px-6 py-28">
      <Reveal>
        <div className="relative overflow-hidden rounded-3xl border border-accent/20 bg-gradient-to-br from-accent/[0.08] via-background to-background px-8 py-16 text-center sm:px-16">
          <div className="pointer-events-none absolute inset-0 bg-arena-grid opacity-60" />
          <div className="relative mx-auto flex max-w-2xl flex-col items-center">
            <span className="flex size-14 items-center justify-center rounded-2xl border border-accent/25 bg-accent/10 text-accent">
              <HugeiconsIcon icon={POT_ICON} size={28} strokeWidth={1.5} />
            </span>
            <p className="mt-8 font-mono text-xs uppercase tracking-[0.22em] text-accent">
              {POT.eyebrow} {livePot !== null ? `· ${livePot.toFixed(2)} USDC LIVE` : ""}
            </p>
            <h2 className="mt-4 whitespace-pre-line font-display text-4xl font-semibold leading-tight tracking-tight sm:text-6xl">
              {POT.title}
            </h2>
            <p className="mt-6 text-lg leading-relaxed text-muted">{POT.body}</p>
            <CtaButton href={POT.cta.href} label={POT.cta.label} beam className="mt-10" />
          </div>
        </div>
      </Reveal>
    </section>
  );
}
