import { NetworkBroadcaster } from "./broadcaster.ts";
import { watch } from "./chain/wallet.ts";
import { routeEvent } from "./events.ts";
import { makeMentionFetcher, pollMentions } from "./mentions.ts";
import { COORDINATION_PROGRAM_ID, DIRAC_PROGRAM_ID } from "./network.ts";
import { refreshRate } from "./refresh.ts";
import { loadOperator } from "./secrets.ts";
import { ensureVoucher } from "./voucher.ts";

const DIRAC_IDL = new URL("../../programs/dirac/dirac.idl", import.meta.url).pathname;
const RATE_REFRESH_MS = 30 * 60 * 1000;
const MENTION_POLL_MS = 5 * 60 * 1000;

async function main(): Promise<void> {
  const operator = loadOperator();
  const voucher = await ensureVoucher(operator.hexAddress, COORDINATION_PROGRAM_ID);
  const broadcaster = new NetworkBroadcaster({ mnemonic: operator.mnemonic, voucher });

  console.log(`dirac runner live — watching ${DIRAC_PROGRAM_ID}, posting as the operator participant`);

  const tickRate = () => refreshRate(operator.mnemonic).catch((error) => console.error("rate refresh failed:", error));
  void tickRate();
  const rateTimer = setInterval(tickRate, RATE_REFRESH_MS);

  const fetchMentions = makeMentionFetcher(operator.mnemonic);
  let mentionCursor = (await fetchMentions(0n).catch(() => ({ headers: [], nextSeq: 0n }))).nextSeq;
  const tickMentions = async () => {
    mentionCursor = await pollMentions(fetchMentions, broadcaster, mentionCursor);
  };
  const mentionTimer = setInterval(() => void tickMentions().catch((error) => console.error("mention poll failed:", error)), MENTION_POLL_MS);

  const stop = watch(DIRAC_PROGRAM_ID, DIRAC_IDL, (raw) => {
    routeEvent(raw, broadcaster).catch((error) => console.error("broadcast failed:", error));
  });

  process.on("SIGINT", () => {
    clearInterval(rateTimer);
    clearInterval(mentionTimer);
    stop();
    process.exit(0);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
