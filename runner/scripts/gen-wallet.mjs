import { Keyring } from "@polkadot/keyring";
import { cryptoWaitReady, mnemonicGenerate } from "@polkadot/util-crypto";
import { u8aToHex } from "@polkadot/util";
import { mkdirSync, writeFileSync } from "node:fs";

const VARA_SS58_FORMAT = 137;
const SECRET_PATH = new URL("../.secrets/operator.json", import.meta.url).pathname;

await cryptoWaitReady();

const mnemonic = mnemonicGenerate(12);
const keyring = new Keyring({ type: "sr25519", ss58Format: VARA_SS58_FORMAT });
const pair = keyring.addFromMnemonic(mnemonic);

const wallet = {
  network: "vara-mainnet",
  ss58Address: pair.address,
  hexAddress: u8aToHex(pair.publicKey),
  mnemonic,
};

mkdirSync(new URL("../.secrets/", import.meta.url).pathname, { recursive: true });
writeFileSync(SECRET_PATH, JSON.stringify(wallet, null, 2));

console.log("SS58 address (share this to receive VARA):");
console.log("  " + wallet.ss58Address);
console.log("Hex address / ActorId (operator field for registration):");
console.log("  " + wallet.hexAddress);
console.log("Mnemonic (SECRET — back it up, never commit):");
console.log("  " + wallet.mnemonic);
console.log("Saved to runner/.secrets/operator.json (git-ignored).");
