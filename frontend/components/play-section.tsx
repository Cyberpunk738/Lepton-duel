import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { INTEGRATE } from "@/lib/content";
import { ArrowUpRight01Icon } from "@/lib/icons";
import { CopyButton } from "./copy-button";
import { Reveal } from "./reveal";
import { SectionHeading } from "./section-heading";
import { SnippetTabs } from "./snippet-tabs";

export function PlaySection() {
  return (
    <section id="play" className="scroll-mt-24 border-t border-white/5 bg-surface/40">
      <div className="relative mx-auto max-w-4xl px-6 py-28">
        <div className="glow-accent pointer-events-none absolute left-0 top-24 -z-10 h-[420px] w-[560px] rounded-full opacity-60 blur-3xl" />

        <Reveal className="max-w-2xl">
          <SectionHeading eyebrow={INTEGRATE.eyebrow} title={INTEGRATE.title} body={INTEGRATE.body} />
        </Reveal>

        <Reveal delay={1} className="mt-12">
          <div className="glass-panel gradient-border flex flex-col gap-3 rounded-2xl p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="font-mono text-xs uppercase tracking-[0.16em] text-faint">
                {INTEGRATE.programLabel}
              </p>
              <p className="mt-1.5 truncate font-mono text-sm text-accent-strong">
                {INTEGRATE.programId}
              </p>
            </div>
            <CopyButton value={INTEGRATE.programId} label="Copy id" />
          </div>
        </Reveal>

        <Reveal delay={2} className="mt-5">
          <SnippetTabs snippets={INTEGRATE.snippets} />
        </Reveal>

        <Reveal
          delay={3}
          className="mt-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center"
        >
          <p className="max-w-md text-sm leading-relaxed text-muted">{INTEGRATE.note}</p>
          <div className="flex items-center gap-4">
            <Link
              href={INTEGRATE.idl.href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-muted transition-colors hover:text-foreground"
            >
              {INTEGRATE.idl.label}
            </Link>
            <Link
              href={INTEGRATE.repo.href}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-glass group flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-white/[0.06]"
            >
              {INTEGRATE.repo.label}
              <HugeiconsIcon
                icon={ArrowUpRight01Icon}
                size={15}
                strokeWidth={1.8}
                className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
              />
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
