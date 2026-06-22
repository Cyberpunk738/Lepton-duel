import { describe, expect, it } from "vitest";
import type { Broadcaster } from "../src/core/handlers.ts";
import { decodeMentionsPage, pollMentions } from "../src/mentions.ts";

const ALICE = "0x1111111111111111111111111111111111111111111111111111111111111111";
const BOB = "0x2222222222222222222222222222222222222222222222222222222222222222";

function recordingBroadcaster(): { replies: { body: string; mentions: string[]; replyTo: bigint }[]; out: Broadcaster } {
  const replies: { body: string; mentions: string[]; replyTo: bigint }[] = [];
  const out: Broadcaster = {
    chat: async () => {},
    board: async () => {},
    x: async () => {},
    reply: async (r) => {
      replies.push(r);
    },
  };
  return { replies, out };
}

describe("decodeMentionsPage", () => {
  it("normalizes headers and next_seq from a vara-wallet result envelope", () => {
    const page = decodeMentionsPage({
      result: {
        headers: [
          { msg_id: "7", block: 100, author: { Participant: ALICE } },
          { msg_id: "8", block: 101, author: { Application: BOB } },
        ],
        overflow: false,
        next_seq: "9",
      },
    });
    expect(page.nextSeq).toBe(9n);
    expect(page.headers).toEqual([
      { msgId: 7n, author: ALICE },
      { msgId: 8n, author: BOB },
    ]);
  });

  it("returns an empty page with the prior cursor when the result is missing", () => {
    const page = decodeMentionsPage(null, 4n);
    expect(page.headers).toEqual([]);
    expect(page.nextSeq).toBe(4n);
  });
});

describe("pollMentions", () => {
  it("replies once per mention, tagging the author and threading the reply", async () => {
    const { replies, out } = recordingBroadcaster();
    const fetcher = async () => ({
      headers: [
        { msgId: 7n, author: ALICE },
        { msgId: 8n, author: BOB },
      ],
      nextSeq: 9n,
    });
    const next = await pollMentions(fetcher, out, 5n);
    expect(next).toBe(9n);
    expect(replies.length).toBe(2);
    expect(replies[0]?.mentions).toEqual([ALICE]);
    expect(replies[0]?.replyTo).toBe(7n);
    expect(replies[1]?.mentions).toEqual([BOB]);
  });

  it("advances the cursor without replying when there are no new mentions", async () => {
    const { replies, out } = recordingBroadcaster();
    const fetcher = async (since: bigint) => ({ headers: [], nextSeq: since });
    const next = await pollMentions(fetcher, out, 9n);
    expect(next).toBe(9n);
    expect(replies.length).toBe(0);
  });

  it("does not advance the cursor when a fetch fails", async () => {
    const { out } = recordingBroadcaster();
    const fetcher = async () => {
      throw new Error("rpc down");
    };
    const next = await pollMentions(fetcher, out, 9n);
    expect(next).toBe(9n);
  });
});
