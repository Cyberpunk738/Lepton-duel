import { describe, expect, it } from "vitest";
import {
  onMatchPlayed,
  onNewChampion,
  onPvpResolved,
  postDailyStandings,
  type Broadcaster,
} from "../src/core/handlers.ts";

const ALICE = "0x1111111111111111111111111111111111111111111111111111111111111111";

type Call = { channel: string; body: string; mentions: string[] };

function recorder(): { calls: Call[]; broadcaster: Broadcaster } {
  const calls: Call[] = [];
  const broadcaster: Broadcaster = {
    chat: async (p) => void calls.push({ channel: "chat", body: p.body, mentions: p.mentions }),
    board: async (_t, body) => void calls.push({ channel: "board", body, mentions: [] }),
    reply: async (r) => void calls.push({ channel: "reply", body: r.body, mentions: r.mentions }),
    x: async (m) => void calls.push({ channel: "x", body: m, mentions: [] }),
  };
  return { calls, broadcaster };
}

describe("event routing", () => {
  it("posts a house match to chat and mentions the player", async () => {
    const { calls, broadcaster } = recorder();
    await onMatchPlayed(
      { player: ALICE, playerMove: "Rock", houseMove: "Scissors", outcome: "Win", newRating: 1516 },
      broadcaster,
    );
    expect(calls.map((c) => c.channel)).toEqual(["chat"]);
    expect(calls[0]?.mentions).toEqual([ALICE]);
  });

  it("announces a new champion on both board and x", async () => {
    const { calls, broadcaster } = recorder();
    await onNewChampion({ player: ALICE, rating: 1800 }, broadcaster);
    expect(calls.map((c) => c.channel)).toEqual(["board", "x"]);
    expect(calls.every((c) => c.body.includes("champion"))).toBe(true);
  });

  it("posts a pvp result to chat and mentions the winner", async () => {
    const { calls, broadcaster } = recorder();
    await onPvpResolved(
      { winner: ALICE, challengerMove: "Rock", opponentMove: "Scissors", payoutVara: 9_750_000_000_000n },
      broadcaster,
    );
    expect(calls.map((c) => c.channel)).toEqual(["chat"]);
    expect(calls[0]?.mentions).toEqual([ALICE]);
  });

  it("omits mentions on a drawn pvp result", async () => {
    const { calls, broadcaster } = recorder();
    await onPvpResolved(
      { winner: null, challengerMove: "Rock", opponentMove: "Rock", payoutVara: 0n },
      broadcaster,
    );
    expect(calls[0]?.mentions).toEqual([]);
  });

  it("posts daily standings to board and x", async () => {
    const { calls, broadcaster } = recorder();
    await postDailyStandings(3, 41, [{ player: ALICE, rating: 1900 }], broadcaster);
    expect(calls.map((c) => c.channel)).toEqual(["board", "x"]);
  });
});
