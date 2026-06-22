import { readFileSync } from "node:fs";

export interface OperatorSecret {
  mnemonic: string;
  hexAddress: string;
  ss58Address: string;
}

export function loadOperator(): OperatorSecret {
  const path = new URL("../.secrets/operator.json", import.meta.url);
  return JSON.parse(readFileSync(path, "utf8")) as OperatorSecret;
}
