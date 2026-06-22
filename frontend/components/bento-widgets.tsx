import { HugeiconsIcon } from "@hugeicons/react";
import { BENTO, LADDER_PREVIEW } from "@/lib/content";
import { ArrowRight01Icon, ChampionIcon, Megaphone01Icon } from "@/lib/icons";

export function HousePredictor() {
  const { bars, predicted, counter } = BENTO.house;
  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {bars.map((bar) => (
          <div key={bar.label} className="flex items-center gap-3">
            <span className="w-16 font-mono text-xs text-faint">{bar.label}</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/5">
              <div
                className={`h-full rounded-full ${bar.width} ${
                  bar.lead ? "bg-accent" : "bg-white/15"
                }`}
              />
            </div>
          </div>
        ))}
      </div>
      <p className="font-mono text-xs text-muted">
        predicts <span className="text-foreground">{predicted}</span> → counters{" "}
        <span className="text-accent-strong">{counter}</span>
      </p>
    </div>
  );
}

export function LadderPreview() {
  return (
    <div className="space-y-2">
      {LADDER_PREVIEW.map((row) => {
        const up = row.delta.startsWith("+");
        return (
          <div
            key={row.rank}
            className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 ${
              row.rank === 1
                ? "border-accent/30 bg-accent/[0.07]"
                : "border-white/5 bg-white/[0.02]"
            }`}
          >
            <span className="font-display text-sm font-semibold text-faint">
              {row.rank}
            </span>
            {row.rank === 1 ? (
              <HugeiconsIcon icon={ChampionIcon} size={16} className="text-accent" />
            ) : (
              <span className="size-4" />
            )}
            <span className="flex-1 font-mono text-xs text-muted">{row.address}</span>
            <span className="font-mono text-sm text-foreground">{row.rating}</span>
            <span className={`font-mono text-xs ${up ? "text-win" : "text-loss"}`}>
              {row.delta}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function CodeSnippet() {
  return (
    <pre className="overflow-x-auto rounded-lg border border-white/5 bg-background/60 p-4 font-mono text-xs leading-relaxed">
      {BENTO.play.snippet.map((line) => (
        <code key={line} className="block whitespace-pre text-muted">
          {line}
        </code>
      ))}
    </pre>
  );
}

export function BroadcastSample() {
  const { sample } = BENTO.broadcast;
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/5 bg-background/60 p-4">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-accent/20 bg-accent/10 text-accent">
        <HugeiconsIcon icon={Megaphone01Icon} size={16} strokeWidth={1.6} />
      </span>
      <p className="text-sm leading-snug text-muted">
        <span className="font-mono text-foreground">{sample.actor}</span>{" "}
        {sample.outcome}{" "}
        <span className="text-accent-strong">{sample.delta}</span>
      </p>
      <HugeiconsIcon
        icon={ArrowRight01Icon}
        size={16}
        className="ml-auto shrink-0 text-faint"
      />
    </div>
  );
}
