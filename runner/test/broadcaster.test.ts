import { describe, expect, it } from "vitest";
import { NetworkBroadcaster, type Caller } from "../src/broadcaster.ts";
import type { CallResult } from "../src/chain/wallet.ts";

const ALICE = "0x1111111111111111111111111111111111111111111111111111111111111111";

function fakeCaller(results: CallResult[]): { calls: unknown[][]; caller: Caller } {
  const calls: unknown[][] = [];
  let index = 0;
  const caller: Caller = async (_pid, _method, args) => {
    calls.push(args);
    return results[index++] ?? { txHash: "0xok" };
  };
  return { calls, caller };
}

describe("NetworkBroadcaster chat fallback", () => {
  it("posts once with mentions when accepted", async () => {
    const { calls, caller } = fakeCaller([{ txHash: "0xok" }]);
    await new NetworkBroadcaster({ mnemonic: "m", voucher: "v" }, caller).chat({ body: "hi", mentions: [ALICE] });
    expect(calls.length).toBe(1);
    expect(calls[0]?.[2]).toEqual([{ Participant: ALICE }]);
  });

  it("retries without mentions when the mentioned post is rejected", async () => {
    const { calls, caller } = fakeCaller([{ reason: "panic", error: "bad mention" }, { txHash: "0xok" }]);
    await new NetworkBroadcaster({ mnemonic: "m", voucher: "v" }, caller).chat({ body: "hi", mentions: [ALICE] });
    expect(calls.length).toBe(2);
    expect(calls[1]?.[2]).toEqual([]);
  });

  it("does not retry when there were no mentions to drop", async () => {
    const { calls, caller } = fakeCaller([{ reason: "panic" }]);
    await new NetworkBroadcaster({ mnemonic: "m", voucher: "v" }, caller).chat({ body: "hi", mentions: [] });
    expect(calls.length).toBe(1);
  });
});
