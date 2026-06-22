"use client";

import { useState, useEffect } from "react";
import { createDuel, playRound, type DuelResult, type DuelState, type Move } from "@/lib/demo-engine";
import { Reveal } from "./reveal";
import { SectionHeading } from "./section-heading";
import { useWeb3Wallet, ARENA_ABI } from "@/lib/web3";
import { CONTRACT_ADDRESS } from "@/lib/content";
import { ethers } from "ethers";

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
    challengeOnChain,
    revealOnChain,
    error: walletError
  } = useWeb3Wallet();

  const [txPending, setTxPending] = useState<boolean>(false);
  const [txError, setTxError] = useState<string>("");
  const [chainResult, setChainResult] = useState<any | null>(null);

  // PvP state variables
  const [chainMode, setChainMode] = useState<"house" | "pvp">("house");
  const [opponentInput, setOpponentInput] = useState<string>("0xf504E19b022768162c0C7e4857eAC290f94e4889");
  const [stakeAmountInput, setStakeAmountInput] = useState<string>("0.000001");
  const [pvpStatus, setPvpStatus] = useState<string>("");
  const [activeMatchId, setActiveMatchId] = useState<string>("");
  const [pvpResult, setPvpResult] = useState<any | null>(null);

  // Load any pending PvP match from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith("lepton_pvp_match_")) {
          const matchId = key.replace("lepton_pvp_match_", "");
          const stored = JSON.parse(localStorage.getItem(key) || "{}");
          if (stored && stored.state !== "resolved") {
            setActiveMatchId(matchId);
            setChainMode("pvp");
            setPvpStatus("Restored pending match. Polling state...");
          }
        }
      }
    }
  }, []);

  // Poll PvP Match state
  useEffect(() => {
    if (!activeMatchId || !isConnected || !address) return;

    let timer: any;
    let isMounted = true;

    const poll = async () => {
      try {
        const provider = new ethers.BrowserProvider(window.ethereum as any);
        const contract = new ethers.Contract(CONTRACT_ADDRESS, ARENA_ABI, provider);
        const matchData = await contract.getMatch(activeMatchId);
        
        const stateNum = Number(matchData.state);
        const challengerRevealed = matchData.challengerRevealed;
        const opponentRevealed = matchData.opponentRevealed;

        const storedStr = localStorage.getItem(`lepton_pvp_match_${activeMatchId}`);
        if (!storedStr) return;
        const stored = JSON.parse(storedStr);

        if (stateNum === 0) {
          if (isMounted) setPvpStatus("Challenge opened! Awaiting opponent to accept...");
        } else if (stateNum === 1) {
          const isChallenger = stored.opponent.toLowerCase() !== address.toLowerCase();
          const ourRevealDone = isChallenger ? challengerRevealed : opponentRevealed;
          
          if (!ourRevealDone) {
            if (isMounted) setPvpStatus("Challenge accepted! Automatically revealing our move...");
            const res = await revealOnChain(activeMatchId, stored.move, stored.salt);
            if (res.success) {
              if (isMounted) setPvpStatus("Our move revealed! Awaiting opponent's reveal...");
            } else {
              if (isMounted) setPvpStatus("Reveal transaction failed. Will retry...");
            }
          } else {
            if (isMounted) setPvpStatus("Our move revealed! Awaiting opponent's reveal...");
          }
        } else if (stateNum === 2) {
          if (isMounted) setPvpStatus("Match settled! Reading final resolution...");
          const filter = contract.filters.PvpResolved(activeMatchId);
          const events = await contract.queryFilter(filter, -2000);
          if (events.length > 0) {
            const eventLog = events[0] as any;
            const { winner, challengerMove, opponentMove, payout } = eventLog.args;
            const resultData = {
              winner,
              challengerMove: Number(challengerMove),
              opponentMove: Number(opponentMove),
              payout: ethers.formatUnits(payout, 6)
            };
            if (isMounted) {
              setPvpResult(resultData);
              setPvpStatus("");
              setActiveMatchId("");
              stored.state = "resolved";
              localStorage.setItem(`lepton_pvp_match_${activeMatchId}`, JSON.stringify(stored));
            }
          }
        } else if (stateNum === 3) {
          if (isMounted) {
            setPvpStatus("Match refunded / timed out.");
            setActiveMatchId("");
            stored.state = "resolved";
            localStorage.setItem(`lepton_pvp_match_${activeMatchId}`, JSON.stringify(stored));
          }
        }
      } catch (err) {
        console.error("Error polling PvP match:", err);
      }

      if (isMounted && activeMatchId) {
        timer = setTimeout(poll, 4000);
      }
    };

    poll();

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [activeMatchId, isConnected, address]);

  const playPvpChallenge = async (moveIdx: number) => {
    setTxPending(true);
    setTxError("");
    setPvpResult(null);
    setPvpStatus("Sending challenge transaction...");
    try {
      const res = await challengeOnChain(opponentInput, moveIdx, stakeAmountInput);
      if (res.success && res.matchId) {
        setActiveMatchId(res.matchId);
        setPvpStatus("Challenge transaction confirmed. Awaiting opponent...");
      } else {
        setTxError(res.error || "Challenge failed");
        setPvpStatus("");
      }
    } catch (err: any) {
      setTxError(err.message || "Execution error");
      setPvpStatus("");
    } finally {
      setTxPending(false);
    }
  };

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

                  {/* Mode select: House vs PvP */}
                  <div className="mt-6 flex gap-4 border-b border-white/5 pb-4">
                    <button
                      onClick={() => setChainMode("house")}
                      className={`font-mono text-[10px] uppercase tracking-widest transition-colors cursor-pointer ${
                        chainMode === "house" ? "text-accent border-b border-accent pb-1 font-semibold" : "text-muted hover:text-foreground"
                      }`}
                    >
                      Duel House
                    </button>
                    <button
                      onClick={() => setChainMode("pvp")}
                      className={`font-mono text-[10px] uppercase tracking-widest transition-colors cursor-pointer ${
                        chainMode === "pvp" ? "text-accent border-b border-accent pb-1 font-semibold" : "text-muted hover:text-foreground"
                      }`}
                    >
                      Challenge Agent (PvP)
                    </button>
                  </div>

                  {chainMode === "house" ? (
                    <>
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
                    </>
                  ) : (
                    <>
                      {/* Opponent inputs */}
                      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                          <label className="block font-mono text-[10px] uppercase tracking-wider text-muted">Opponent Agent Address</label>
                          <input
                            type="text"
                            value={opponentInput}
                            onChange={(e) => setOpponentInput(e.target.value)}
                            placeholder="0x..."
                            disabled={txPending || !!activeMatchId}
                            className="mt-1.5 w-full rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 font-mono text-xs text-foreground placeholder-faint focus:border-accent focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block font-mono text-[10px] uppercase tracking-wider text-muted">Stake Amount (USDC)</label>
                          <input
                            type="text"
                            value={stakeAmountInput}
                            onChange={(e) => setStakeAmountInput(e.target.value)}
                            placeholder="0.000001"
                            disabled={txPending || !!activeMatchId}
                            className="mt-1.5 w-full rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 font-mono text-xs text-foreground placeholder-faint focus:border-accent focus:outline-none"
                          />
                        </div>
                      </div>

                      {/* Transaction status or game result display */}
                      <div className="animate-rise mt-7 flex min-h-[3.75rem] flex-col items-center justify-center rounded-2xl bg-elevated/60 px-5 py-4 text-center">
                        {txPending ? (
                          <div className="flex items-center gap-3">
                            <div className="size-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                            <p className="text-sm text-muted">Awaiting wallet approval & block confirmation on Arc...</p>
                          </div>
                        ) : pvpStatus ? (
                          <div className="flex items-center gap-3">
                            <div className="size-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                            <p className="text-sm text-accent">{pvpStatus}</p>
                          </div>
                        ) : pvpResult ? (
                          <div className="space-y-1">
                            <p className="text-sm leading-relaxed text-foreground">
                              {pvpResult.winner.toLowerCase() === address.toLowerCase() ? (
                                <span className="text-win font-semibold">🎉 You won the PvP match! </span>
                              ) : pvpResult.winner === "0x0000000000000000000000000000000000000000" ? (
                                <span className="text-muted">🤝 The match ended in a DRAW. </span>
                              ) : (
                                <span className="text-loss">😢 You lost the PvP match. </span>
                              )}
                              You played <span className="text-accent">{GLYPH[MOVES[pvpResult.challengerMove]]} {MOVES[pvpResult.challengerMove]}</span>, 
                              opponent played <span className="text-accent">{GLYPH[MOVES[pvpResult.opponentMove]]} {MOVES[pvpResult.opponentMove]}</span>.
                            </p>
                            {pvpResult.winner.toLowerCase() === address.toLowerCase() && (
                              <p className="text-xs font-mono text-accent-strong">Payout: {pvpResult.payout} USDC (received in wallet)</p>
                            )}
                          </div>
                        ) : txError ? (
                          <p className="text-sm font-mono text-loss">{txError}</p>
                        ) : (
                          <p className="text-sm text-muted">Select your move below to escrow USDC and challenge the autonomous agent.</p>
                        )}
                      </div>

                      {/* Move options */}
                      <div className="mt-7 grid grid-cols-3 gap-3">
                        {MOVES.map((move, idx) => (
                          <button
                            key={move}
                            type="button"
                            onClick={() => playPvpChallenge(idx)}
                            disabled={txPending || !!activeMatchId}
                            aria-label={`Challenge with ${move}`}
                            className="btn-glass group flex flex-col items-center gap-2 rounded-2xl px-4 py-5 transition-transform hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0 cursor-pointer"
                          >
                            <span className="text-3xl transition-transform group-hover:scale-110">{GLYPH[move]}</span>
                            <span className="font-mono text-xs uppercase tracking-wider text-muted">{move}</span>
                          </button>
                        ))}
                      </div>
                    </>
                  )}

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
