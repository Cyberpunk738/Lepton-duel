import { VOUCHER_URL } from "./network.ts";

const VOUCHER_MAX_ATTEMPTS = 6;
const VOUCHER_RETRY_MS = 5000;

interface VoucherState {
  voucherId: string | null;
  programs: string[];
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function requestVoucher(operatorHex: string, coverProgramId: string): Promise<string> {
  const state = (await (await fetch(`${VOUCHER_URL}/${operatorHex}`)).json()) as VoucherState;
  if (state.voucherId && state.programs.includes(coverProgramId)) {
    return state.voucherId;
  }
  const response = await fetch(VOUCHER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ account: operatorHex, programs: [coverProgramId] }),
  });
  const body = (await response.json()) as { voucherId?: string };
  if (!body.voucherId) {
    throw new Error(`voucher request failed (${response.status}): ${JSON.stringify(body)}`);
  }
  return body.voucherId;
}

export async function ensureVoucher(operatorHex: string, coverProgramId: string): Promise<string> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= VOUCHER_MAX_ATTEMPTS; attempt += 1) {
    try {
      return await requestVoucher(operatorHex, coverProgramId);
    } catch (error) {
      lastError = error;
      if (attempt === VOUCHER_MAX_ATTEMPTS) break;
      const wait = VOUCHER_RETRY_MS * attempt;
      console.error(
        `voucher attempt ${attempt}/${VOUCHER_MAX_ATTEMPTS} failed; retrying in ${wait}ms:`,
        error instanceof Error ? error.message : error,
      );
      await delay(wait);
    }
  }
  throw lastError;
}
