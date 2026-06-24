"use client";

import { useEffect, useState, useCallback } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ChampionIcon, RankingIcon } from "@/lib/icons";
import { Reveal } from "./reveal";
import { SectionHeading } from "./section-heading";
import {
  fetchFullLeaderboard,
  fetchPlayerStats,
  type FullLeaderboardEntry,
  type PlayerStats,
} from "@/lib/web3";

const MOVE_LABELS = ["🪨", "📄", "✂️"] as const;
const MOVE_NAMES = ["Rock", "Paper", "Scissors"] as const;
const REFRESH_INTERVAL = 20_000; // 20 seconds

function WinRateBar({ wins, losses, draws }: { wins: number; losses: number; draws: number }) {
  const total = wins + losses + draws;
  if (total === 0) return <div className="h-1.5 w-full rounded-full bg-white/5" />;
  const wPct = (wins / total) * 100;
  const dPct = (draws / total) * 100;
  const lPct = (losses / total) * 100;
  return (
    <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-white/5">
      {wPct > 0 && (
        <div className="h-full bg-win transition-all duration-500" style={{ width: `${wPct}%` }} />
      )}
      {dPct > 0 && (
        <div className="h-full bg-faint transition-all duration-500" style={{ width: `${dPct}%` }} />
      )}
      {lPct > 0 && (
        <div className="h-full bg-loss transition-all duration-500" style={{ width: `${lPct}%` }} />
      )}
    </div>
  );
}

function PlayerDetailModal({
  entry,
  stats,
  loading,
  onClose,
}: {
  entry: FullLeaderboardEntry;
  stats: PlayerStats | null;
  loading: boolean;
  onClose: () => void;
}) {
  const total = stats ? stats.wins + stats.losses + stats.draws : 0;
  const winRate = total > 0 && stats ? ((stats.wins / total) * 100).toFixed(1) : "0.0";

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="leaderboard-modal-enter glass-panel gradient-border relative mx-4 w-full max-w-md overflow-hidden rounded-2xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="glow-accent-tr pointer-events-none absolute inset-0 opacity-40" />
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1.5 text-faint transition-colors hover:bg-white/5 hover:text-foreground cursor-pointer"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>

        <div className="relative">
          {/* Header */}
          <div className="flex items-center gap-3">
            <div className={`flex size-10 items-center justify-center rounded-xl text-sm font-bold ${
              entry.rank === 1
                ? "border border-accent/30 bg-accent/10 text-accent"
                : entry.rank === 2
                ? "border border-yellow-500/30 bg-yellow-500/10 text-yellow-400"
                : entry.rank === 3
                ? "border border-orange-400/30 bg-orange-400/10 text-orange-300"
                : "border border-white/10 bg-white/5 text-faint"
            }`}>
              {entry.rank <= 3 ? (
                <HugeiconsIcon icon={ChampionIcon} size={18} />
              ) : (
                `#${entry.rank}`
              )}
            </div>
            <div>
              <p className="font-mono text-sm text-foreground">{entry.fullAddress}</p>
              <p className="mt-0.5 font-mono text-xs text-faint">
                Rank #{entry.rank} · {entry.rating} Elo
              </p>
            </div>
          </div>

          {/* Stats Grid */}
          {loading ? (
            <div className="mt-6 flex items-center justify-center py-8">
              <div className="leaderboard-spinner size-6 rounded-full border-2 border-accent/20 border-t-accent" />
            </div>
          ) : stats ? (
            <>
              <div className="mt-6 grid grid-cols-4 gap-px overflow-hidden rounded-xl border border-white/8 bg-white/8">
                {[
                  { label: "Games", value: stats.games },
                  { label: "Wins", value: stats.wins },
                  { label: "Losses", value: stats.losses },
                  { label: "Draws", value: stats.draws },
                ].map((s) => (
                  <div key={s.label} className="bg-surface px-3 py-3 text-center">
                    <p className="font-display text-lg font-semibold text-foreground">{s.value}</p>
                    <p className="mt-0.5 text-[10px] uppercase tracking-[0.12em] text-faint">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Win rate */}
              <div className="mt-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted">Win rate</span>
                  <span className="font-mono text-foreground">{winRate}%</span>
                </div>
                <div className="mt-2">
                  <WinRateBar wins={stats.wins} losses={stats.losses} draws={stats.draws} />
                </div>
                <div className="mt-1.5 flex justify-between text-[10px] text-faint">
                  <span className="flex items-center gap-1">
                    <span className="inline-block size-1.5 rounded-full bg-win" /> W
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block size-1.5 rounded-full bg-faint" /> D
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block size-1.5 rounded-full bg-loss" /> L
                  </span>
                </div>
              </div>

              {/* Move distribution */}
              <div className="mt-4">
                <p className="text-xs text-muted">Move distribution</p>
                <div className="mt-2 space-y-1.5">
                  {MOVE_NAMES.map((name, i) => {
                    const moveTotal = stats.moveCounts[0] + stats.moveCounts[1] + stats.moveCounts[2];
                    const pct = moveTotal > 0 ? (stats.moveCounts[i] / moveTotal) * 100 : 0;
                    return (
                      <div key={name} className="flex items-center gap-2">
                        <span className="w-6 text-center text-sm">{MOVE_LABELS[i]}</span>
                        <span className="w-14 font-mono text-xs text-faint">{name}</span>
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/5">
                          <div
                            className="h-full rounded-full bg-accent/60 transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="w-10 text-right font-mono text-xs text-faint">
                          {pct.toFixed(0)}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          ) : (
            <p className="mt-6 text-center text-sm text-faint">Failed to load player data.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <span className="flex size-7 items-center justify-center rounded-lg border border-accent/30 bg-accent/10">
        <HugeiconsIcon icon={ChampionIcon} size={14} className="text-accent" />
      </span>
    );
  }
  if (rank === 2) {
    return (
      <span className="flex size-7 items-center justify-center rounded-lg border border-yellow-500/20 bg-yellow-500/[0.07] font-display text-xs font-bold text-yellow-400">
        2
      </span>
    );
  }
  if (rank === 3) {
    return (
      <span className="flex size-7 items-center justify-center rounded-lg border border-orange-400/20 bg-orange-400/[0.07] font-display text-xs font-bold text-orange-300">
        3
      </span>
    );
  }
  return (
    <span className="flex size-7 items-center justify-center rounded-lg border border-white/5 bg-white/[0.02] font-display text-xs font-semibold text-faint">
      {rank}
    </span>
  );
}

export function Leaderboard() {
  const [entries, setEntries] = useState<FullLeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<FullLeaderboardEntry | null>(null);
  const [selectedStats, setSelectedStats] = useState<PlayerStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  const loadLeaderboard = useCallback(async () => {
    try {
      const data = await fetchFullLeaderboard(25);
      if (data.length > 0) {
        setEntries(data);
      }
      setLastRefresh(new Date());
    } catch (err) {
      console.error("Leaderboard fetch failed:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLeaderboard();
    const interval = setInterval(loadLeaderboard, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [loadLeaderboard]);

  const handlePlayerClick = async (entry: FullLeaderboardEntry) => {
    setSelectedEntry(entry);
    setStatsLoading(true);
    setSelectedStats(null);
    try {
      const stats = await fetchPlayerStats(entry.fullAddress);
      setSelectedStats(stats);
    } catch (err) {
      console.error("Failed to fetch player stats:", err);
    } finally {
      setStatsLoading(false);
    }
  };

  return (
    <section id="play" className="scroll-mt-24 border-t border-white/5">
      <div className="relative mx-auto max-w-5xl px-6 py-28">
        <div className="glow-accent pointer-events-none absolute right-0 top-8 -z-10 h-[420px] w-[600px] rounded-full opacity-50 blur-3xl" />

        <Reveal className="max-w-2xl">
          <SectionHeading
            eyebrow="The ladder"
            title="Live on-chain leaderboard"
            body="Every ranking is pulled directly from the Arc smart contract. No backend, no caching — pure on-chain truth."
          />
        </Reveal>

        {/* Refresh indicator */}
        <Reveal delay={1}>
          <div className="mt-8 flex items-center gap-3">
            <span className="size-1.5 animate-pulse rounded-full bg-win" />
            <span className="font-mono text-xs text-faint">
              Live · {lastRefresh ? `updated ${lastRefresh.toLocaleTimeString()}` : "loading..."}
            </span>
            <button
              onClick={() => { setLoading(true); loadLeaderboard(); }}
              className="ml-auto rounded-full border border-white/8 px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-faint transition-all hover:border-accent/30 hover:text-accent cursor-pointer"
            >
              Refresh
            </button>
          </div>
        </Reveal>

        {/* Table */}
        <Reveal delay={2} className="mt-4">
          <div className="overflow-hidden rounded-2xl border border-white/8">
            {/* Header */}
            <div className="grid grid-cols-[3rem_1fr_5rem_4.5rem_4.5rem_4.5rem_5rem] items-center gap-2 border-b border-white/5 bg-white/[0.02] px-4 py-3 text-[10px] uppercase tracking-[0.14em] text-faint sm:grid-cols-[3rem_1fr_5rem_4.5rem_4.5rem_4.5rem_5rem]">
              <span>Rank</span>
              <span>Player</span>
              <span className="text-right">Rating</span>
              <span className="text-right hidden sm:block">W</span>
              <span className="text-right hidden sm:block">L</span>
              <span className="text-right hidden sm:block">D</span>
              <span className="text-right">Win %</span>
            </div>

            {/* Loading skeleton */}
            {loading && entries.length === 0 && (
              <div className="space-y-px">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div
                    key={i}
                    className="grid grid-cols-[3rem_1fr_5rem_4.5rem_4.5rem_4.5rem_5rem] items-center gap-2 px-4 py-3.5"
                  >
                    <div className="h-4 w-7 animate-pulse rounded bg-white/5" />
                    <div className="h-4 w-24 animate-pulse rounded bg-white/5" />
                    <div className="ml-auto h-4 w-10 animate-pulse rounded bg-white/5" />
                    <div className="ml-auto hidden h-4 w-6 animate-pulse rounded bg-white/5 sm:block" />
                    <div className="ml-auto hidden h-4 w-6 animate-pulse rounded bg-white/5 sm:block" />
                    <div className="ml-auto hidden h-4 w-6 animate-pulse rounded bg-white/5 sm:block" />
                    <div className="ml-auto h-4 w-10 animate-pulse rounded bg-white/5" />
                  </div>
                ))}
              </div>
            )}

            {/* Empty state */}
            {!loading && entries.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <HugeiconsIcon icon={RankingIcon} size={32} className="text-faint" />
                <p className="mt-4 font-display text-lg font-semibold text-muted">No players yet</p>
                <p className="mt-1 text-sm text-faint">
                  Be the first to duel the house and claim rank #1
                </p>
              </div>
            )}

            {/* Rows */}
            {entries.map((entry, i) => {
              const total = entry.wins + entry.losses + entry.draws;
              const winPct = total > 0 ? ((entry.wins / total) * 100).toFixed(1) : "-";
              return (
                <button
                  key={entry.fullAddress}
                  onClick={() => handlePlayerClick(entry)}
                  className={`leaderboard-row group grid w-full cursor-pointer grid-cols-[3rem_1fr_5rem_4.5rem_4.5rem_4.5rem_5rem] items-center gap-2 border-b border-white/[0.03] px-4 py-3.5 text-left transition-colors last:border-b-0 hover:bg-white/[0.03] ${
                    entry.rank === 1
                      ? "bg-accent/[0.04]"
                      : i % 2 === 0
                      ? "bg-transparent"
                      : "bg-white/[0.01]"
                  }`}
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  <RankBadge rank={entry.rank} />
                  <span className="truncate font-mono text-xs text-muted group-hover:text-foreground transition-colors">
                    {entry.address}
                    <span className="ml-2 hidden text-[10px] text-faint sm:inline">
                      {entry.games > 0 ? `${entry.games} games` : ""}
                    </span>
                  </span>
                  <span className={`text-right font-mono text-sm font-semibold ${
                    entry.rank === 1 ? "text-accent" : "text-foreground"
                  }`}>
                    {entry.rating}
                  </span>
                  <span className="text-right font-mono text-xs text-win hidden sm:block">{entry.wins}</span>
                  <span className="text-right font-mono text-xs text-loss hidden sm:block">{entry.losses}</span>
                  <span className="text-right font-mono text-xs text-faint hidden sm:block">{entry.draws}</span>
                  <span className="text-right font-mono text-xs text-muted">
                    {winPct !== "-" ? `${winPct}%` : "—"}
                  </span>
                </button>
              );
            })}
          </div>
        </Reveal>

        {/* Footer note */}
        {entries.length > 0 && (
          <Reveal delay={3}>
            <p className="mt-4 text-center font-mono text-[10px] uppercase tracking-[0.14em] text-faint">
              Showing top {entries.length} players · Data read directly from contract on Arc Testnet
            </p>
          </Reveal>
        )}
      </div>

      {/* Player Detail Modal */}
      {selectedEntry && (
        <PlayerDetailModal
          entry={selectedEntry}
          stats={selectedStats}
          loading={statsLoading}
          onClose={() => setSelectedEntry(null)}
        />
      )}
    </section>
  );
}
