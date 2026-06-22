import { describe, expect, it } from "vitest";
import {
  championPost,
  dailyStandingsPost,
  formatVara,
  houseMatchPost,
  mentionReplyPost,
  pvpResultPost,
  shortActor,
} from "../src/core/posts.ts";

const ALICE = "0x1111111111111111111111111111111111111111111111111111111111111111";
const BOB = "0x2222222222222222222222222222222222222222222222222222222222222222";

describe("shortActor", () => {
  it("abbreviates a 32-byte address", () => {
    expect(shortActor(ALICE)).toBe("0x111111…1111");
  });
});

describe("formatVara", () => {
  it("renders 12-decimal base units as VARA", () => {
    expect(formatVara(9_750_000_000_000n)).toBe("9.75");
    expect(formatVara(5_000_000_000_000n)).toBe("5.00");
    expect(formatVara(0n)).toBe("0.00");
  });
});

describe("houseMatchPost", () => {
  it("tags the player and states a win with new rating", () => {
    const post = houseMatchPost({
      player: ALICE,
      playerMove: "Rock",
      houseMove: "Scissors",
      outcome: "Win",
      newRating: 1516,
    });
    expect(post).toContain(shortActor(ALICE));
    expect(post).toContain("beat the house");
    expect(post).toContain("1516");
    expect(post).toContain("@dirac");
  });

  it("distinguishes a loss", () => {
    const post = houseMatchPost({
      player: ALICE,
      playerMove: "Rock",
      houseMove: "Paper",
      outcome: "Loss",
      newRating: 1484,
    });
    expect(post).toContain("fell to the house");
  });
});

describe("championPost", () => {
  it("announces the new champion and rating", () => {
    const post = championPost({ player: BOB, rating: 1800 });
    expect(post).toContain(shortActor(BOB));
    expect(post).toContain("1800");
    expect(post).toContain("champion");
  });
});

describe("pvpResultPost", () => {
  it("credits the winner with the payout", () => {
    const post = pvpResultPost({
      winner: ALICE,
      challengerMove: "Rock",
      opponentMove: "Scissors",
      payoutVara: 9_750_000_000_000n,
    });
    expect(post).toContain(shortActor(ALICE));
    expect(post).toContain("9.75");
  });

  it("reports a draw with no winner", () => {
    const post = pvpResultPost({
      winner: null,
      challengerMove: "Rock",
      opponentMove: "Rock",
      payoutVara: 0n,
    });
    expect(post).toContain("draw");
    expect(post).not.toContain("won a staked duel");
  });
});

describe("dailyStandingsPost", () => {
  it("numbers the leaderboard and respects the limit", () => {
    const entries = [
      { player: ALICE, rating: 1900 },
      { player: BOB, rating: 1700 },
    ];
    const post = dailyStandingsPost(3, 41, entries, 1);
    expect(post).toContain("Day 3");
    expect(post).toContain("41 duels");
    expect(post).toContain(`1. ${shortActor(ALICE)} — 1900`);
    expect(post).not.toContain(shortActor(BOB));
  });
});

describe("mentionReplyPost", () => {
  it("invites the mention author to duel the house", () => {
    const reply = mentionReplyPost(0);
    expect(reply).toContain("@dirac");
    expect(reply).toMatch(/Play/);
  });

  it("varies the reply by index so replies are not identical", () => {
    expect(mentionReplyPost(0)).not.toBe(mentionReplyPost(1));
  });
});
