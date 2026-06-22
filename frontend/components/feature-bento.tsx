import { HugeiconsIcon } from "@hugeicons/react";
import type { IconSvgElement } from "@hugeicons/react";
import type { ReactNode } from "react";
import { BENTO, HOUSE } from "@/lib/content";
import { Reveal } from "./reveal";
import { SectionHeading } from "./section-heading";
import {
  HousePredictor,
  LadderPreview,
  CodeSnippet,
  BroadcastSample,
} from "./bento-widgets";

interface BentoCardProps {
  icon: IconSvgElement;
  title: string;
  body: string;
  className?: string;
  delay?: number;
  children: ReactNode;
}

function BentoCard({ icon, title, body, className, delay, children }: BentoCardProps) {
  return (
    <Reveal delay={delay} className={`h-full ${className ?? ""}`}>
      <article className="glass-panel gradient-border group relative flex h-full flex-col gap-5 overflow-hidden rounded-2xl p-7">
        <div className="glow-accent-tr pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-700 group-hover:opacity-100" />
        <div className="relative flex flex-col gap-3">
          <HugeiconsIcon icon={icon} size={26} strokeWidth={1.5} className="text-accent" />
          <h3 className="font-display text-xl font-semibold">{title}</h3>
          <p className="text-sm leading-relaxed text-muted">{body}</p>
        </div>
        <div className="relative mt-auto">{children}</div>
      </article>
    </Reveal>
  );
}

export function FeatureBento() {
  return (
    <section id="house" className="border-t border-white/5 bg-surface/40">
      <div className="relative mx-auto max-w-6xl overflow-hidden px-6 py-28">
        <div className="glow-accent pointer-events-none absolute right-0 top-20 -z-10 h-[420px] w-[600px] rounded-full opacity-70 blur-3xl" />

        <Reveal className="max-w-2xl">
          <SectionHeading eyebrow={HOUSE.eyebrow} title={HOUSE.title} body={HOUSE.body} />
        </Reveal>

        <div className="mt-16 grid gap-5 lg:grid-cols-3">
          <BentoCard
            icon={BENTO.house.icon}
            title={BENTO.house.title}
            body={BENTO.house.body}
            className="lg:col-span-2"
          >
            <HousePredictor />
          </BentoCard>

          <BentoCard
            icon={BENTO.ladder.icon}
            title={BENTO.ladder.title}
            body={BENTO.ladder.body}
            className="lg:row-span-2"
            delay={1}
          >
            <LadderPreview />
          </BentoCard>

          <BentoCard
            icon={BENTO.play.icon}
            title={BENTO.play.title}
            body={BENTO.play.body}
            delay={2}
          >
            <CodeSnippet />
          </BentoCard>

          <BentoCard
            icon={BENTO.broadcast.icon}
            title={BENTO.broadcast.title}
            body={BENTO.broadcast.body}
            delay={3}
          >
            <BroadcastSample />
          </BentoCard>
        </div>
      </div>
    </section>
  );
}
