import { call } from "./chain/wallet.ts";
import { DIRAC_PROGRAM_ID, VARABRIDGE_PROGRAM_ID } from "./network.ts";

const DIRAC_IDL = new URL("../../programs/dirac/dirac.idl", import.meta.url).pathname;
const VARABRIDGE_IDL = new URL("../refs/vara_bridge.idl", import.meta.url).pathname;
const PRICE_API = "https://api.coingecko.com/api/v3/simple/price?ids=vara-network&vs_currencies=usd";
const MICRO_PER_USD = 1_000_000;

interface PriceFeed {
  price_usd_micro?: string | number;
}

async function fromVaraBridge(mnemonic: string): Promise<number | null> {
  try {
    const res = await call(VARABRIDGE_PROGRAM_ID, "VaraBridge/GetPrice", ["VARA"], { idl: VARABRIDGE_IDL, mnemonic });
    const micro = (res.result as PriceFeed | null)?.price_usd_micro;
    if (micro !== undefined && Number(micro) > 0) return Number(micro);
  } catch (error) {
    console.error("VaraBridge price unavailable:", error);
  }
  return null;
}

async function fromPublicFeed(): Promise<number | null> {
  try {
    const body = (await (await fetch(PRICE_API)).json()) as Record<string, { usd?: number }>;
    const usd = body["vara-network"]?.usd;
    if (usd && usd > 0) return Math.round(usd * MICRO_PER_USD);
  } catch (error) {
    console.error("public price feed unavailable:", error);
  }
  return null;
}

let lastRate = 0;

export async function refreshRate(mnemonic: string): Promise<void> {
  const micro = (await fromVaraBridge(mnemonic)) ?? (await fromPublicFeed());
  if (!micro || micro === lastRate) return;
  await call(DIRAC_PROGRAM_ID, "Admin/SetVaraUsdRate", [String(micro)], { idl: DIRAC_IDL, mnemonic });
  lastRate = micro;
  console.log(`rate refreshed → ${micro} µ$/VARA`);
}
