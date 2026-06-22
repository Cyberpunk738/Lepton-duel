"use client";

import { useState } from "react";
import { createDuel, playRound, type DuelResult, type DuelState, type Move } from "@/lib/demo-engine";
import { Reveal } from "./reveal";
import { SectionHeading } from "./section-heading";
import { useWeb3Wallet } from "@/lib/web3";

const MOVES: Move[] = ["Rock", "Paper", "Scissors"];
const GLYPH: Record<Move, string> = { Rock: "🪨", Paper: "📄", Scissors: "✂️" };
const OUTCOME_TONE: Record<DuelResult["outcome"], string> = {
  Win: "text-win",
  Loss: "text-loss",
  Draw: "text-muted",
};
const OUTCOME_VERB: Record<DuelResult["outcome"], string> = { Win: "won", Loss: "lost", Draw: "drew" };
const SKILLS_URL = "https://github.com/Cyberpunk738/Lepton-duel/tree/main/contracts";

const ON_CHAIN_OUTCOME_VERB = ["won", "lost", "drew"];
const ON_CHAIN_OUTCOME_TONE = ["text-win", "text-loss", "text-muted"];

export function DemoDuel() {
  const [state, setState] = useState<DuelState>(createDuel);
  const [last, setLast] = useState<DuelResult | null>(null);
  const [activeTab, setActiveTab] = useState<"sim" | "chain">("sim");

  // Web3 Wallet Hook
  const {
    isConnected,
    address,
    connect,
    loading: walletLoading,
    elo,
    stats: onChainStats,
    playOnChain,
    error: walletError
  } = useWeb3Wallet();

  const [txPending, setTxPending] = useState<boolean>(false);
  const [txError, setTxError] = useState<string>("");
  const [chainResult, setChainResult] = useState<any | null>(null);

  const playLocal = (move: Move) => {
    const next = playRound(state, move);
    setState(next.state);
    setLast(next.result);
  };

  const resetLocal = () => {
    setState(createDuel());
    setLast(null);
  };

  const playChainGame = async (moveIdx: number) => {
    setTxPending(true);
    setTxError("");
    setChainResult(null);
    try {
      const res = await playOnChain(moveIdx);
      if (res.success) {
        setChainResult({
          playerMove: MOVES[moveIdx],
          houseMove: MOVES[res.houseMove !== undefined ? res.houseMove : 0],
          outcome: res.outcome !== undefined ? res.outcome : 0,
          newRating: res.newRating !== undefined ? res.newRating : elo,
          txHash: res.txHash
        });
      } else {
        setTxError(res.error || "Transaction failed");
      }
    } catch (err: any) {
      setTxError(err.message || "Execution error");
    } finally {
      setTxPending(false);
    }
  };

  const total = state.moveCounts[0] + state.moveCounts[1] + state.moveCounts[2];

  return (
    <section id="demo" className="relative mx-auto max-w-3xl overflow-hidden px-6 py-28">
      <div className="glow-accent pointer-events-none absolute left-1/2 top-0 -z-10 h-[360px] w-[640px] -translate-x-1/2 rounded-full opacity-50 blur-3xl" />

      <Reveal className="mx-auto max-w-2xl">
        <SectionHeading eyebrow="Play Lepton Arena" title="Step into the arena" align="center" />
        <p className="mt-4 text-center text-sm leading-relaxed text-muted">
          Test your strategy in the local sandbox simulator, or switch to the on-chain arena to duel the house live on Arc Testnet.
        </p>

        {/* Tab Controls */}
        <div className="mt-8 flex justify-center gap-2">
          <button
            onClick={() => setActiveTab("sim")}
            className={`rounded-full px-5 py-2 text-xs font-mono uppercase tracking-wider transition-all cursor-pointer ${
              activeTab === "sim"
                ? "bg-accent text-background font-semibold"
                : "bg-white/5 text-muted hover:bg-white/10 hover:text-foreground"
            }`}
          >
            Sandbox Simulation
          </button>
          <button
            onClick={() => setActiveTab("chain")}
            className={`rounded-full px-5 py-2 text-xs font-mono uppercase tracking-wider transition-all cursor-pointer ${
              activeTab === "chain"
                ? "bg-accent text-background font-semibold"
                : "bg-white/5 text-muted hover:bg-white/10 hover:text-foreground"
            }`}
          >
            Arc On-Chain Arena
          </button>
        </div>
      </Reveal>

      <Reveal delay={1}>
        <div className="glass-panel gradient-border mt-10 rounded-3xl p-7 sm:p-9">
          
          {/* SANDBOX SIMULATOR TAB */}
          {activeTab === "sim" && (
            <>
              <div className="flex items-end justify-between">
                <div>
                  <p className="font-mono text-xs uppercase tracking-widest text-faint">Sandbox Elo</p>
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
                    onClick={() => playLocal(move)}
                    aria-label={`Play ${move}`}
                    className="btn-glass group flex flex-col items-center gap-2 rounded-2xl px-4 py-5 transition-transform hover:-translate-y-0.5 cursor-pointer"
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
                  onClick={resetLocal}
                  className="font-mono text-xs uppercase tracking-wider text-faint transition-colors hover:text-muted cursor-pointer"
                >
                  Reset Sandbox
                </button>
                <a
                  href={SKILLS_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-xs text-accent transition-colors hover:text-accent-strong"
                >
                  View contract code on GitHub →
                </a>
              </div>
            </>
          )}

          {/* ARC ON-CHAIN ARENA TAB */}
          {activeTab === "chain" && (
            <>
              {!isConnected ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <span className="text-5xl">⚔️</span>
                  <h3 className="mt-4 text-lg font-semibold text-foreground">On-Chain Mode Requires Wallet</h3>
                  <p className="mt-2 max-w-sm text-sm text-muted">
                    Connect your wallet to retrieve your on-chain Elo rating, record matches directly to the block, and duel for real.
                  </p>
                  <button
                    onClick={connect}
                    disabled={walletLoading}
                    className="mt-6 rounded-full bg-accent px-6 py-2.5 text-sm font-semibold text-background transition-colors hover:bg-accent-strong disabled:opacity-50 cursor-pointer"
                  >
                    {walletLoading ? "Connecting..." : "Connect Wallet"}
                  </button>
                  {walletError && <p className="mt-3 font-mono text-xs text-loss">{walletError}</p>}
                </div>
              ) : (
                <>
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="font-mono text-xs uppercase tracking-widest text-faint">On-Chain Elo</p>
                      <p className="font-display text-5xl font-semibold text-gradient-accent">{elo}</p>
                    </div>
                    {onChainStats && (
                      <div className="text-right font-mono text-xs text-muted">
                        <p>
                          <span className="text-win">{onChainStats.wins}W</span> · <span className="text-loss">{onChainStats.losses}L</span> ·{" "}
                          {onChainStats.draws}D
                        </p>
                        <p className="mt-1 text-faint">{onChainStats.games} games played</p>
                      </div>
                    )}
                  </div>

                  {/* Transaction status or game result display */}
                  <div className="animate-rise mt-7 flex min-h-[3.75rem] flex-col items-center justify-center rounded-2xl bg-elevated/60 px-5 py-4 text-center">
                    {txPending ? (
                      <div className="flex items-center gap-3">
                        <div className="size-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                        <p className="text-sm text-muted">Awaiting wallet approval & block confirmation on Arc...</p>
                      </div>
                    ) : chainResult ? (
                      <div className="space-y-1">
                        <p className="text-sm leading-relaxed text-foreground">
                          House played <span className="text-accent">{GLYPH[chainResult.houseMove as Move]} {chainResult.houseMove}</span> — you{" "}
                          <span className={`font-semibold ${ON_CHAIN_OUTCOME_TONE[chainResult.outcome]}`}>
                            {ON_CHAIN_OUTCOME_VERB[chainResult.outcome]}
                          </span>{" "}
                          — rating now <span className="font-mono font-semibold text-accent-strong">{chainResult.newRating}</span>
                        </p>
                        <a
                          href={`https://testnet.arcscan.app/tx/${chainResult.txHash}`}
                          target="_blank"
                          rel="noreferrer"
                          className="block font-mono text-[10px] text-faint hover:underline hover:text-muted"
                        >
                          Tx Hash: {chainResult.txHash.slice(0, 10)}...{chainResult.txHash.slice(-8)}
                        </a>
                      </div>
                    ) : txError ? (
                      <p className="text-sm font-mono text-loss">{txError}</p>
                    ) : (
                      <p className="text-sm text-muted">Submit your move. Signing a transaction duels the live house contract.</p>
                    )}
                  </div>

                  {/* Move options */}
                  <div className="mt-7 grid grid-cols-3 gap-3">
                    {MOVES.map((move, idx) => (
                      <button
                        key={move}
                        type="button"
                        onClick={() => playChainGame(idx)}
                        disabled={txPending}
                        aria-label={`Play ${move} On-Chain`}
                        className="btn-glass group flex flex-col items-center gap-2 rounded-2xl px-4 py-5 transition-transform hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0 cursor-pointer"
                      >
                        <span className="text-3xl transition-transform group-hover:scale-110">{GLYPH[move]}</span>
                        <span className="font-mono text-xs uppercase tracking-wider text-muted">{move}</span>
                      </button>
                    ))}
                  </div>

                  {/* On-chain player move breakdown */}
                  {onChainStats && onChainStats.games > 0 && (
                    <div className="mt-8">
                      <p className="font-mono text-xs uppercase tracking-widest text-faint">Your on-chain moves frequency</p>
                      <div className="mt-3 space-y-2">
                        {MOVES.map((move, index) => {
                          const count = onChainStats.moveCounts[index];
                          const pct = onChainStats.games === 0 ? 0 : Math.round((count / onChainStats.games) * 100);
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
                  )}

                  <div className="mt-8 border-t border-white/8 pt-6 flex justify-between items-center text-xs font-mono text-faint">
                    <span>Connected as: {address.slice(0, 12)}...{address.slice(-10)}</span>
                    <a
                      href={`https://testnet.arcscan.app/address/${address}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-accent hover:underline hover:text-accent-strong"
                    >
                      View Account on Explorer
                    </a>
                  </div>
                </>
              )}
            </>
          )}

        </div>
      </Reveal>
    </section>
  );
}
