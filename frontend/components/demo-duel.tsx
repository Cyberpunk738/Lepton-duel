"use client";

import { useState } from "react";
import { createDuel, playRound, type DuelResult, type DuelState, type Move } from "@/lib/demo-engine";
import { Reveal } from "./reveal";
import { SectionHeading } from "./section-heading";

const MOVES: Move[] = ["Rock", "Paper", "Scissors"];
const GLYPH: Record<Move, string> = { Rock: "🪨", Paper: "📄", Scissors: "✂️" };
const OUTCOME_TONE: Record<DuelResult["outcome"], string> = {
  Win: "text-win",
  Loss: "text-loss",
  Draw: "text-muted",
};
const OUTCOME_VERB: Record<DuelResult["outcome"], string> = { Win: "won", Loss: "lost", Draw: "drew" };
const SKILLS_URL = "https://github.com/Enoch208/Dirac/tree/main/contracts";

export function DemoDuel() {
  const [state, setState] = useState<DuelState>(createDuel);
  const [last, setLast] = useState<DuelResult | null>(null);

  const play = (move: Move) => {
    const next = playRound(state, move);
    setState(next.state);
    setLast(next.result);
  };

  const reset = () => {
    setState(createDuel());
    setLast(null);
  };

  const total = state.moveCounts[0] + state.moveCounts[1] + state.moveCounts[2];

  return (
    <section id="demo" className="relative mx-auto max-w-3xl overflow-hidden px-6 py-28">
      <div className="glow-accent pointer-events-none absolute left-1/2 top-0 -z-10 h-[360px] w-[640px] -translate-x-1/2 rounded-full opacity-50 blur-3xl" />

      <Reveal className="mx-auto max-w-2xl">
        <SectionHeading eyebrow="Try it" title="Duel the house yourself" align="center" />
        <p className="mt-4 text-center text-sm leading-relaxed text-muted">
          This runs the exact on-chain house logic in your browser — no wallet, no chain. Make a few moves and watch it
          learn your pattern and turn it against you.
        </p>
      </Reveal>

      <Reveal delay={1}>
        <div className="glass-panel gradient-border mt-12 rounded-3xl p-7 sm:p-9">
          <div className="flex items-end justify-between">
            <div>
              <p className="font-mono text-xs uppercase tracking-widest text-faint">Your rating</p>
              <p className="font-display text-5xl font-semibold text-gradient-accent">{state.rating}</p>
            </div>
            <div className="text-right font-mono text-xs text-muted">
              <p>
                <span className="text-win">{state.wins}W</span> · <span className="text-loss">{state.losses}L</span> ·{" "}
                {state.draws}D
              </p>
              <p className="mt-1 text-faint">{state.games} duels</p>
            </div>
          </div>

          <div key={state.games} className="animate-rise mt-7 flex min-h-[3.75rem] items-center justify-center rounded-2xl bg-elevated/60 px-5 py-4 text-center">
            {last ? (
              <p className="text-sm leading-relaxed text-foreground">
                House read you for <span className="text-accent">{GLYPH[last.housePredicted]} {last.housePredicted}</span>
                , played <span className="text-accent">{GLYPH[last.houseMove]} {last.houseMove}</span> — you{" "}
                <span className={`font-semibold ${OUTCOME_TONE[last.outcome]}`}>{OUTCOME_VERB[last.outcome]}</span>{" "}
                <span className="font-mono text-muted">
                  ({last.ratingDelta >= 0 ? "+" : ""}
                  {last.ratingDelta})
                </span>
                {last.wasRandom ? <span className="ml-2 font-mono text-xs text-faint">· house rolled random</span> : null}
              </p>
            ) : (
              <p className="text-sm text-muted">Make your move. After a few rounds, it starts predicting you.</p>
            )}
          </div>

          <div className="mt-7 grid grid-cols-3 gap-3">
            {MOVES.map((move) => (
              <button
                key={move}
                type="button"
                onClick={() => play(move)}
                aria-label={`Play ${move}`}
                className="btn-glass group flex flex-col items-center gap-2 rounded-2xl px-4 py-5 transition-transform hover:-translate-y-0.5"
              >
                <span className="text-3xl transition-transform group-hover:scale-110">{GLYPH[move]}</span>
                <span className="font-mono text-xs uppercase tracking-wider text-muted">{move}</span>
              </button>
            ))}
          </div>

          <div className="mt-8">
            <p className="font-mono text-xs uppercase tracking-widest text-faint">What the house sees in you</p>
            <div className="mt-3 space-y-2">
              {MOVES.map((move, index) => {
                const pct = total === 0 ? 0 : Math.round((state.moveCounts[index] / total) * 100);
                return (
                  <div key={move} className="flex items-center gap-3">
                    <span className="w-16 font-mono text-xs text-muted">{move}</span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/5">
                      <div className="h-full rounded-full bg-accent/70 transition-all duration-500" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-9 text-right font-mono text-xs text-faint">{pct}%</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-8 flex flex-col items-center gap-4 border-t border-white/8 pt-6 sm:flex-row sm:justify-between">
            <button
              type="button"
              onClick={reset}
              className="font-mono text-xs uppercase tracking-wider text-faint transition-colors hover:text-muted"
            >
              Reset
            </button>
            <a
              href={SKILLS_URL}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-xs text-accent transition-colors hover:text-accent-strong"
            >
              That&apos;s the real house — play on-chain on Arc →
            </a>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
