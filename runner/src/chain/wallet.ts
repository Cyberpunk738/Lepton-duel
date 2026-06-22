import { execFile, spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { homedir } from "node:os";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const VW = process.env.VARA_WALLET ?? `${homedir()}/.npm-global/bin/vara-wallet`;
const MAX_BUFFER = 4 * 1024 * 1024;
const WATCH_RESTART_MS = 5000;
const CALL_MAX_ATTEMPTS = 4;
const CALL_RETRY_MS = 1500;
const TRANSIENT_ERROR_MARKERS = [
  "1014",
  "Priority is too low",
  "too low priority",
  "1010",
  "Transaction is outdated",
  "temporarily banned",
];

export interface CallOptions {
  idl: string;
  mnemonic: string;
  voucher?: string;
  value?: string;
}

export interface CallResult {
  txHash?: string;
  blockNumber?: number;
  result?: unknown;
  reason?: string;
  error?: string;
}

function lastJsonLine(stdout: string): string {
  const lines = stdout.trim().split("\n").filter((l) => l.trim().startsWith("{"));
  return lines[lines.length - 1] ?? "{}";
}

async function runCall(
  programId: string,
  method: string,
  args: unknown[],
  opts: CallOptions,
): Promise<CallResult> {
  const cliArgs = [
    "--network", "mainnet", "--json",
    "call", programId, method,
    "--args", JSON.stringify(args),
    "--idl", opts.idl,
  ];
  if (opts.voucher) cliArgs.push("--voucher", opts.voucher);
  if (opts.value) cliArgs.push("--value", opts.value);
  const { stdout } = await execFileAsync(VW, cliArgs, {
    maxBuffer: MAX_BUFFER,
    env: { ...process.env, VARA_MNEMONIC: opts.mnemonic },
  });
  return JSON.parse(lastJsonLine(stdout)) as CallResult;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransient(error: unknown): boolean {
  const stderr = error instanceof Error ? (error as { stderr?: string }).stderr ?? "" : "";
  const text = `${error instanceof Error ? error.message : String(error)} ${stderr}`;
  return TRANSIENT_ERROR_MARKERS.some((marker) => text.includes(marker));
}

let writeQueue: Promise<unknown> = Promise.resolve();

export async function call(
  programId: string,
  method: string,
  args: unknown[],
  opts: CallOptions,
): Promise<CallResult> {
  const run = writeQueue.then(async () => {
    let lastError: unknown;
    for (let attempt = 1; attempt <= CALL_MAX_ATTEMPTS; attempt += 1) {
      try {
        return await runCall(programId, method, args, opts);
      } catch (error) {
        lastError = error;
        if (!isTransient(error) || attempt === CALL_MAX_ATTEMPTS) throw error;
        console.error(`${method} transient failure (attempt ${attempt}/${CALL_MAX_ATTEMPTS}); retrying`);
        await delay(CALL_RETRY_MS * attempt);
      }
    }
    throw lastError;
  });
  writeQueue = run.then(() => undefined, () => undefined);
  return run;
}

export function watch(
  programId: string,
  idl: string,
  onEvent: (raw: unknown) => void,
): () => void {
  let stopped = false;
  let child: ReturnType<typeof spawn> | null = null;
  let restartTimer: ReturnType<typeof setTimeout> | null = null;

  const scheduleRestart = (reason: string) => {
    if (stopped || restartTimer) return;
    console.error(`vara-wallet watch ${reason}; reconnecting in ${WATCH_RESTART_MS}ms`);
    restartTimer = setTimeout(() => {
      restartTimer = null;
      start();
    }, WATCH_RESTART_MS);
  };

  const start = () => {
    if (stopped) return;
    const proc = spawn(VW, ["--network", "mainnet", "watch", programId, "--idl", idl]);
    child = proc;
    proc.on("error", (error) => scheduleRestart(`spawn failed: ${error.message}`));
    proc.on("exit", (code, signal) => scheduleRestart(`exited (code ${code}, signal ${signal})`));

    const reader = createInterface({ input: proc.stdout });
    reader.on("line", (line) => {
      const trimmed = line.trim();
      if (!trimmed.startsWith("{")) return;
      try {
        onEvent(JSON.parse(trimmed));
      } catch {
        return;
      }
    });
  };

  start();

  return () => {
    stopped = true;
    if (restartTimer) clearTimeout(restartTimer);
    child?.kill();
  };
}
