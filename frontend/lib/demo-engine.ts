export type Move = "Rock" | "Paper" | "Scissors";
export type Outcome = "Win" | "Loss" | "Draw";

export interface DuelState {
  rating: number;
  games: number;
  wins: number;
  losses: number;
  draws: number;
  moveCounts: [number, number, number];
  recent: Move[];
}

export interface DuelResult {
  playerMove: Move;
  housePredicted: Move;
  houseMove: Move;
  outcome: Outcome;
  ratingDelta: number;
  wasRandom: boolean;
}

const MOVES: readonly Move[] = ["Rock", "Paper", "Scissors"];
const STARTING_RATING = 1500;
const HOUSE_RATING = 1500;
const ELO_K = 32;
const HOUSE_EPSILON = 0.2;
const RECENT_WINDOW = 8;
const TABLE_STEP = 25;
const RATING_DIFF_CLAMP = 800;
const SCORE_WIN = 1000;
const SCORE_DRAW = 500;
const SCORE_LOSS = 0;

const EXPECTED_SCORE_TABLE = [
  500, 464, 429, 394, 360, 327, 297, 267, 240, 215, 192, 170, 151, 133, 118, 104, 91, 80, 70, 61,
  53, 46, 40, 35, 31, 27, 23, 20, 17, 15, 13, 11, 10,
];

const moveIndex = (move: Move): number => MOVES.indexOf(move);

export function createDuel(): DuelState {
  return { rating: STARTING_RATING, games: 0, wins: 0, losses: 0, draws: 0, moveCounts: [0, 0, 0], recent: [] };
}

export function counter(move: Move): Move {
  return move === "Rock" ? "Paper" : move === "Paper" ? "Scissors" : "Rock";
}

export function resolve(player: Move, opponent: Move): Outcome {
  if (player === opponent) return "Draw";
  return counter(opponent) === player ? "Win" : "Loss";
}

export function predict(state: DuelState): Move {
  const score = [...state.moveCounts];
  state.recent.forEach((move, position) => {
    score[moveIndex(move)] += position + 1;
  });
  let best = 0;
  for (let i = 1; i < MOVES.length; i += 1) {
    if (score[i] > score[best]) best = i;
  }
  return MOVES[best];
}

function roundDiv(numerator: number, denominator: number): number {
  const half = Math.trunc(denominator / 2);
  return numerator >= 0
    ? Math.trunc((numerator + half) / denominator)
    : Math.trunc((numerator - half) / denominator);
}

function interpolateExpected(diff: number): number {
  const index = Math.trunc(diff / TABLE_STEP);
  const remainder = diff % TABLE_STEP;
  const low = EXPECTED_SCORE_TABLE[index];
  if (remainder === 0 || index + 1 === EXPECTED_SCORE_TABLE.length) return low;
  const high = EXPECTED_SCORE_TABLE[index + 1];
  return low + roundDiv((high - low) * remainder, TABLE_STEP);
}

export function expectedScore(player: number, opponent: number): number {
  const diff = Math.max(-RATING_DIFF_CLAMP, Math.min(RATING_DIFF_CLAMP, opponent - player));
  return diff >= 0 ? interpolateExpected(diff) : SCORE_WIN - interpolateExpected(-diff);
}

export function ratingDelta(player: number, opponent: number, scoreMilli: number): number {
  return roundDiv(ELO_K * (scoreMilli - expectedScore(player, opponent)), 1000);
}

function scoreMilli(outcome: Outcome): number {
  return outcome === "Win" ? SCORE_WIN : outcome === "Draw" ? SCORE_DRAW : SCORE_LOSS;
}

export function houseMove(state: DuelState, rng: () => number = Math.random): { move: Move; predicted: Move; wasRandom: boolean } {
  const total = state.moveCounts[0] + state.moveCounts[1] + state.moveCounts[2];
  const predicted = predict(state);
  if (total === 0 || rng() < HOUSE_EPSILON) {
    return { move: MOVES[Math.trunc(rng() * MOVES.length) % MOVES.length], predicted, wasRandom: true };
  }
  return { move: counter(predicted), predicted, wasRandom: false };
}

export function playRound(state: DuelState, playerMove: Move, rng: () => number = Math.random): { result: DuelResult; state: DuelState } {
  const { move: house, predicted, wasRandom } = houseMove(state, rng);
  const outcome = resolve(playerMove, house);
  const delta = ratingDelta(state.rating, HOUSE_RATING, scoreMilli(outcome));

  const recent = [...state.recent, playerMove].slice(-RECENT_WINDOW);
  const moveCounts: [number, number, number] = [...state.moveCounts];
  moveCounts[moveIndex(playerMove)] += 1;

  const next: DuelState = {
    rating: state.rating + delta,
    games: state.games + 1,
    wins: state.wins + (outcome === "Win" ? 1 : 0),
    losses: state.losses + (outcome === "Loss" ? 1 : 0),
    draws: state.draws + (outcome === "Draw" ? 1 : 0),
    moveCounts,
    recent,
  };

  return {
    result: { playerMove, housePredicted: predicted, houseMove: house, outcome, ratingDelta: delta, wasRandom },
    state: next,
  };
}
