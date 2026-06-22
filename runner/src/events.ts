import { onMatchPlayed, onNewChampion, onPvpResolved, type Broadcaster } from "./core/handlers.ts";
import type { MoveName, OutcomeName } from "./core/posts.ts";

const MOVES: readonly MoveName[] = ["Rock", "Paper", "Scissors"];
const OUTCOMES: readonly OutcomeName[] = ["Win", "Loss", "Draw"];
const EVENT_NAMES = [
  "MatchPlayed",
  "NewChampion",
  "PvpResolved",
  "ChallengeOpened",
  "ChallengeAccepted",
  "MatchForfeited",
  "MatchRefunded",
];

type Data = Record<string, unknown>;

export function variantName(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") return Object.keys(value as Data)[0] ?? "";
  return "";
}

export function toMove(value: unknown): MoveName {
  const name = variantName(value);
  return MOVES.find((m) => m === name) ?? "Rock";
}

export function toOutcome(value: unknown): OutcomeName {
  const name = variantName(value);
  return OUTCOMES.find((o) => o === name) ?? "Draw";
}

export function toActor(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const v = value as Data;
    return String(v.value ?? v.Participant ?? v.Application ?? "");
  }
  return "";
}

function scan(o: Data): { name: string; data: Data } | null {
  for (const key of Object.keys(o)) {
    if (EVENT_NAMES.includes(key) && o[key] && typeof o[key] === "object") {
      return { name: key, data: o[key] as Data };
    }
  }
  return null;
}

export function extractEvent(raw: unknown): { name: string; data: Data } | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Data;

  const decoded = obj.decoded as Data | undefined;
  if (decoded && typeof decoded === "object") {
    const decodedName = decoded.event as string | undefined;
    const decodedData = decoded.data as Data | undefined;
    if (typeof decodedName === "string" && EVENT_NAMES.includes(decodedName) && decodedData && typeof decodedData === "object") {
      return { name: decodedName, data: decodedData };
    }
  }

  const name = (obj.name ?? obj.event ?? obj.method) as string | undefined;
  const payload = (obj.payload ?? obj.data ?? obj.args) as Data | undefined;
  if (typeof name === "string" && EVENT_NAMES.includes(name) && payload && typeof payload === "object") {
    return { name, data: payload };
  }
  return scan(obj) ?? (obj.Game && typeof obj.Game === "object" ? scan(obj.Game as Data) : null);
}

export async function routeEvent(raw: unknown, out: Broadcaster): Promise<boolean> {
  const event = extractEvent(raw);
  if (!event) return false;
  const d = event.data;
  switch (event.name) {
    case "MatchPlayed":
      await onMatchPlayed(
        {
          player: toActor(d.player),
          playerMove: toMove(d.player_move),
          houseMove: toMove(d.house_move),
          outcome: toOutcome(d.outcome),
          newRating: Number(d.new_rating),
        },
        out,
      );
      return true;
    case "NewChampion":
      await onNewChampion({ player: toActor(d.player), rating: Number(d.rating) }, out);
      return true;
    case "PvpResolved":
      await onPvpResolved(
        {
          winner: d.winner ? toActor(d.winner) : null,
          challengerMove: toMove(d.challenger_move),
          opponentMove: toMove(d.opponent_move),
          payoutVara: BigInt(String(d.payout ?? "0")),
        },
        out,
      );
      return true;
    default:
      return false;
  }
}
