import { TERMINAL } from "@/lib/content";

const DOTS = ["bg-loss/60", "bg-accent/60", "bg-win/60"] as const;
const [COMMAND, RESULT, META] = TERMINAL.lines;

export function TerminalWindow() {
  return (
    <div className="glass-panel gradient-border overflow-hidden rounded-2xl text-left backdrop-blur-md">
      <div className="flex items-center gap-2 border-b border-white/5 px-4 py-3">
        {DOTS.map((dot) => (
          <span key={dot} className={`size-2.5 rounded-full ${dot}`} />
        ))}
        <span className="ml-2 font-mono text-xs text-faint">{TERMINAL.title}</span>
      </div>

      <div className="space-y-4 px-5 py-5 font-mono text-sm">
        <div className="flex gap-3">
          <span className="select-none text-accent-deep">{COMMAND.prompt}</span>
          <span className="text-foreground">
            <span className="text-accent-strong">Play</span>
            <span className="text-faint">(</span>
            Move::Rock
            <span className="text-faint">)</span>
          </span>
        </div>

        <div className="rounded-lg border border-white/5 border-l-2 border-l-accent/60 bg-background/60 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs uppercase tracking-[0.16em] text-faint">
              {RESULT.prompt}
            </span>
            <span className="rounded-full bg-win/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-win">
              Win
            </span>
          </div>
          <p className="mt-2 text-foreground">{RESULT.text}</p>
          <p className="mt-1 text-accent-strong">{META.text}</p>
        </div>
      </div>
    </div>
  );
}
