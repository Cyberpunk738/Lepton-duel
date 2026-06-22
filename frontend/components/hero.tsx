import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { HERO, HERO_STATS, PRIMARY_CTA, SECONDARY_CTA } from "@/lib/content";
import { CodeIcon } from "@/lib/icons";
import { CtaButton } from "./cta-button";
import { Reveal } from "./reveal";
import { TerminalWindow } from "./terminal-window";
import { FlipText } from "./flip-text";

const LAST_WORD = HERO.titleWords.length - 1;

const COLUMNS = [
  { delay: "[animation-delay:0ms]", panel: "h-[70%]" },
  { delay: "[animation-delay:110ms]", panel: "h-[56%]" },
  { delay: "[animation-delay:220ms]", panel: "h-[46%]" },
  { delay: "[animation-delay:330ms]", panel: "h-[40%]" },
  { delay: "[animation-delay:440ms]", panel: "h-[46%]" },
  { delay: "[animation-delay:550ms]", panel: "h-[56%]" },
  { delay: "[animation-delay:660ms]", panel: "h-[70%]" },
] as const;

export function Hero() {
  return (
    <section className="relative overflow-hidden pt-44 pb-24">
      <div className="pointer-events-none absolute left-0 top-0 -z-30 h-[660px] w-[640px] overflow-hidden mask-corner-tl">
        <div className="absolute -inset-6 bg-dots dots-drift opacity-80" />
      </div>
      <div className="pointer-events-none absolute right-0 top-0 -z-30 h-[660px] w-[640px] overflow-hidden mask-corner-tr">
        <div className="absolute -inset-6 bg-dots dots-drift opacity-80" />
      </div>
      <div className="pointer-events-none absolute inset-0 -z-20 bg-noise opacity-[0.03] mix-blend-overlay" />
      <div className="pointer-events-none absolute inset-0 -z-20 mx-auto grid max-w-5xl grid-cols-7 [mask-image:linear-gradient(to_bottom,transparent,#000_18%,#000_72%,transparent)]">
        {COLUMNS.map((column, index) => (
          <div
            key={index}
            className={`col-reveal relative border-l border-white/[0.035] last:border-r ${column.delay}`}
          >
            <div
              className={`absolute inset-x-0 bottom-0 ${column.panel} border-t border-white/[0.07] bg-gradient-to-t from-white/[0.018] to-transparent`}
            />
          </div>
        ))}
      </div>
      <div className="pointer-events-none absolute left-1/2 top-[6%] -z-10 h-[560px] w-[640px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_50%_55%_at_50%_40%,rgba(255,255,255,0.07),transparent_70%)]" />
      <div className="glow-accent pointer-events-none absolute left-1/2 top-[-12%] -z-10 h-[560px] w-[1000px] -translate-x-1/2 animate-glow-pulse rounded-full blur-3xl" />

      <div className="relative mx-auto flex max-w-4xl flex-col items-center px-6 text-center">
        <Reveal className="flex flex-col items-center">
          <div className="glass-panel mb-8 flex items-center gap-2.5 rounded-full px-4 py-1.5 text-xs font-medium text-muted">
            <span className="size-1.5 animate-pulse rounded-full bg-win" />
            {HERO.badge}
            <span className="h-3 w-px bg-white/10" />
            <span className="text-accent-strong">{HERO.tag}</span>
          </div>

          <h1 className="flex flex-wrap justify-center gap-x-[0.3em] font-display text-[clamp(2.5rem,9vw,6rem)] font-bold leading-[0.95] tracking-[-0.03em]">
            {HERO.titleWords.map((word, index) => (
              <FlipText
                key={word}
                word={word}
                baseClassName={index === LAST_WORD ? "text-gradient-accent" : "text-gradient-fade"}
                revealClassName={index === LAST_WORD ? "text-accent-strong" : "text-foreground"}
              />
            ))}
          </h1>

          <p className="mt-8 max-w-2xl text-balance text-lg leading-relaxed text-muted sm:text-xl">
            {HERO.subtitle}
          </p>

          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <CtaButton href={PRIMARY_CTA.href} label={PRIMARY_CTA.label} beam />
            <Link
              href={SECONDARY_CTA.href}
              className="btn-glass flex items-center justify-center gap-2 rounded-full px-7 py-3.5 text-sm font-medium text-foreground transition-colors hover:bg-white/[0.06]"
            >
              <HugeiconsIcon icon={CodeIcon} size={18} strokeWidth={1.6} />
              {SECONDARY_CTA.label}
            </Link>
          </div>
        </Reveal>

        <Reveal delay={2} className="mt-16 w-full max-w-2xl">
          <TerminalWindow />
        </Reveal>

        <Reveal delay={3} className="mt-12 w-full max-w-2xl">
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/8 bg-white/8 sm:grid-cols-4">
            {HERO_STATS.map((stat) => (
              <div key={stat.label} className="bg-surface px-4 py-5">
                <dt className="font-display text-2xl font-semibold text-accent-strong">
                  {stat.value}
                </dt>
                <dd className="mt-1 text-xs uppercase tracking-[0.14em] text-faint">
                  {stat.label}
                </dd>
              </div>
            ))}
          </dl>
        </Reveal>
      </div>
    </section>
  );
}
