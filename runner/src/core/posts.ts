export type MoveName = "Rock" | "Paper" | "Scissors";
export type OutcomeName = "Win" | "Loss" | "Draw";

export interface HouseMatch {
  player: string;
  playerMove: MoveName;
  houseMove: MoveName;
  outcome: OutcomeName;
  newRating: number;
}

export interface ChampionChange {
  player: string;
  rating: number;
}

export interface PvpResult {
  winner: string | null;
  challengerMove: MoveName;
  opponentMove: MoveName;
  payoutVara: bigint;
}

export interface StandingsEntry {
  player: string;
  rating: number;
}

const ARENA_HANDLE = "@dirac";
const ARENA_NAME = "the Dirac Colosseum";
const ADDRESS_PREFIX_LEN = 6;
const ADDRESS_SUFFIX_LEN = 4;
const VARA_DECIMALS = 12n;
const VARA_FRACTION_DIGITS = 2;
const DEFAULT_STANDINGS_LIMIT = 10;

const MOVE_GLYPH: Record<MoveName, string> = {
  Rock: "🪨",
  Paper: "📄",
  Scissors: "✂️",
};

const OUTCOME_VERDICT: Record<OutcomeName, string> = {
  Win: "beat the house",
  Loss: "fell to the house",
  Draw: "drew the house",
};

export function shortActor(id: string): string {
  const body = id.startsWith("0x") ? id.slice(2) : id;
  if (body.length <= ADDRESS_PREFIX_LEN + ADDRESS_SUFFIX_LEN) {
    return `0x${body}`;
  }
  return `0x${body.slice(0, ADDRESS_PREFIX_LEN)}…${body.slice(-ADDRESS_SUFFIX_LEN)}`;
}

export function formatVara(raw: bigint): string {
  const unit = 10n ** VARA_DECIMALS;
  const whole = raw / unit;
  const scale = 10n ** BigInt(VARA_FRACTION_DIGITS);
  const fraction = ((raw % unit) * scale) / unit;
  return `${whole}.${fraction.toString().padStart(VARA_FRACTION_DIGITS, "0")}`;
}

export function houseMatchPost(match: HouseMatch): string {
  const who = shortActor(match.player);
  const duel = `${MOVE_GLYPH[match.playerMove]} vs ${MOVE_GLYPH[match.houseMove]}`;
  return `⚔️ ${who} ${OUTCOME_VERDICT[match.outcome]} ${duel} — now rated ${match.newRating} in ${ARENA_NAME}. Challenge it: ${ARENA_HANDLE}`;
}

export function championPost(change: ChampionChange): string {
  return `👑 New champion — ${shortActor(change.player)} tops ${ARENA_NAME} at ${change.rating}. Come dethrone them. ${ARENA_HANDLE}`;
}

export function pvpResultPost(result: PvpResult): string {
  const duel = `${MOVE_GLYPH[result.challengerMove]} vs ${MOVE_GLYPH[result.opponentMove]}`;
  if (result.winner === null) {
    return `🤝 A staked duel in ${ARENA_NAME} ended in a draw ${duel} — stakes returned. ${ARENA_HANDLE}`;
  }
  return `⚔️ ${shortActor(result.winner)} won a staked duel ${duel}, taking ${formatVara(result.payoutVara)} VARA in ${ARENA_NAME}. ${ARENA_HANDLE}`;
}

const MENTION_REPLIES: readonly string[] = [
  `Heard you in the arena. The house is adapting — send Game/Play to test your read. ${ARENA_HANDLE}`,
  `Thanks for the shout. One message duels the adaptive house; out-pattern it to climb the ladder. Game/Play → ${ARENA_HANDLE}`,
  `Appreciate the mention. Luck won't crack the house here — Play a move and let strategy talk. ${ARENA_HANDLE}`,
  `Good to see you. The ladder's live and the house learns fast — Game/Play to stake your rank. ${ARENA_HANDLE}`,
];

export function mentionReplyPost(index: number): string {
  return MENTION_REPLIES[index % MENTION_REPLIES.length] as string;
}

export function dailyStandingsPost(
  day: number,
  totalDuels: number,
  entries: StandingsEntry[],
  limit: number = DEFAULT_STANDINGS_LIMIT,
): string {
  const board = entries
    .slice(0, limit)
    .map((entry, index) => `${index + 1}. ${shortActor(entry.player)} — ${entry.rating}`)
    .join("\n");
  return `Day ${day} in ${ARENA_NAME} — ${totalDuels} duels today.\n${board}\nOne message to play: ${ARENA_HANDLE}`;
}
