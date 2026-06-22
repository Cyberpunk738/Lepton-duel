import { describe, expect, it } from "vitest";
import { extractEvent, routeEvent, toActor, toMove, toOutcome } from "../src/events.ts";
import type { Broadcaster, ChatPost } from "../src/core/handlers.ts";

const ALICE = "0x1111111111111111111111111111111111111111111111111111111111111111";

describe("variant normalizers", () => {
  it("reads moves as string or scale-enum object", () => {
    expect(toMove("Paper")).toBe("Paper");
    expect(toMove({ Scissors: null })).toBe("Scissors");
    expect(toMove(undefined)).toBe("Rock");
  });
  it("reads outcomes either shape", () => {
    expect(toOutcome("Loss")).toBe("Loss");
    expect(toOutcome({ Win: null })).toBe("Win");
  });
  it("reads actor ids as string or wrapped", () => {
    expect(toActor(ALICE)).toBe(ALICE);
    expect(toActor({ value: ALICE })).toBe(ALICE);
  });
});

describe("extractEvent", () => {
  it("handles { name, payload }", () => {
    const e = extractEvent({ name: "MatchPlayed", payload: { player: ALICE } });
    expect(e?.name).toBe("MatchPlayed");
  });
  it("handles nested { MatchPlayed: {...} }", () => {
    const e = extractEvent({ MatchPlayed: { player: ALICE } });
    expect(e?.name).toBe("MatchPlayed");
  });
  it("handles service-wrapped { Game: { NewChampion: {...} } }", () => {
    const e = extractEvent({ Game: { NewChampion: { player: ALICE, rating: 1700 } } });
    expect(e?.name).toBe("NewChampion");
  });
  it("handles the real vara-wallet watch envelope (decoded.event/data)", () => {
    const raw = {
      event: "UserMessageSent",
      destination: "0x0000000000000000000000000000000000000000000000000000000000000000",
      decoded: { kind: "sails", service: "Game", event: "MatchPlayed", data: { player: ALICE, new_rating: 1516 } },
    };
    const e = extractEvent(raw);
    expect(e?.name).toBe("MatchPlayed");
    expect((e?.data as Record<string, unknown>).player).toBe(ALICE);
  });

  it("ignores the reply line (no decoded sails event)", () => {
    expect(extractEvent({ event: "UserMessageSent", payload: "0x", details: { replyTo: "0xabc" } })).toBeNull();
  });

  it("returns null for unrelated lines", () => {
    expect(extractEvent({ foo: 1 })).toBeNull();
    expect(extractEvent("ready")).toBeNull();
  });
});

function recorder(): { posts: ChatPost[]; broadcaster: Broadcaster } {
  const posts: ChatPost[] = [];
  const broadcaster: Broadcaster = {
    chat: async (p) => void posts.push(p),
    board: async () => {},
    reply: async () => {},
    x: async () => {},
  };
  return { posts, broadcaster };
}

describe("routeEvent", () => {
  it("routes a MatchPlayed into a chat post mentioning the player", async () => {
    const { posts, broadcaster } = recorder();
    const handled = await routeEvent(
      {
        name: "MatchPlayed",
        payload: { player: ALICE, player_move: "Rock", house_move: { Scissors: null }, outcome: "Win", new_rating: 1516 },
      },
      broadcaster,
    );
    expect(handled).toBe(true);
    expect(posts[0]?.mentions).toEqual([ALICE]);
    expect(posts[0]?.body).toContain("beat the house");
  });

  it("ignores events it does not handle", async () => {
    const { broadcaster } = recorder();
    expect(await routeEvent({ name: "ChallengeOpened", payload: {} }, broadcaster)).toBe(false);
  });
});
