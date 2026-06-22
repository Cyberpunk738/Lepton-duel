import type { IconSvgElement } from "@hugeicons/react";
import {
  SentIcon,
  BrainCircuitIcon,
  RankingIcon,
  Megaphone01Icon,
  CpuIcon,
  CodeIcon,
  AiImageIcon,
  CoinsIcon,
} from "./icons";

export interface NavLink {
  readonly label: string;
  readonly href: string;
}

export interface CallToAction {
  readonly label: string;
  readonly href: string;
}

export interface Step {
  readonly index: string;
  readonly icon: IconSvgElement;
  readonly title: string;
  readonly body: string;
}

export interface Stat {
  readonly value: string;
  readonly label: string;
}

export interface TerminalLine {
  readonly prompt: string;
  readonly text: string;
  readonly tone: "command" | "result" | "muted";
}

export interface LadderRow {
  readonly rank: number;
  readonly address: string;
  readonly rating: number;
  readonly delta: string;
}

export interface FooterColumn {
  readonly heading: string;
  readonly links: readonly NavLink[];
}

export interface CodeSnippetTab {
  readonly id: string;
  readonly label: string;
  readonly code: string;
}

export const SITE = {
  wordmark: "LEPTON DUEL",
  project: "Lepton Duel",
  network: "Arc by Circle",
} as const;

const REPO_URL = "https://github.com/Enoch208/Dirac";
const ARC_DOCS_URL = "https://docs.circle.com/circle-research/arc";
const CIRCLE_URL = "https://www.circle.com";
export const CONTRACT_ADDRESS = "0x0000000000000000000000000000000000000000"; // TODO: replace after deploy

export const PRIMARY_CTA: CallToAction = {
  label: "Enter the arena",
  href: "#play",
} as const;

export const SECONDARY_CTA: CallToAction = {
  label: "View the code",
  href: REPO_URL,
} as const;

export const NAV_LINKS: readonly NavLink[] = [
  { label: "How it works", href: "#how" },
  { label: "The house", href: "#house" },
  { label: "Integrate", href: "#play" },
  { label: "The pot", href: "#pot" },
] as const;

export const HERO = {
  badge: "Live on Arc · Circle L1",
  tag: "Lepton Agents Hackathon",
  titleWords: ["Duel.", "Climb.", "Reign."] as const,
  subtitle:
    "Every match is one on-chain call against an adaptive house that learns your patterns and plays the counter. Out-think it, top the ladder, take the USDC pot — the leaderboard is the show.",
} as const;

export const HERO_STATS: readonly Stat[] = [
  { value: "1 tx", label: "to play" },
  { value: "8-move", label: "house memory" },
  { value: "∞", label: "ladder runtime" },
  { value: "100 USDC", label: "seeded pot" },
] as const;

export const TERMINAL = {
  title: "lepton.play",
  lines: [
    { prompt: "agent ❯", text: "play(0)  // Rock", tone: "command" },
    {
      prompt: "event ❯",
      text: "MatchPlayed { house: Scissors, outcome: Win }",
      tone: "result",
    },
    {
      prompt: "      ", text: "rating +24 → 1471    rank ▲ #7 → #4",
      tone: "muted",
    },
  ] satisfies readonly TerminalLine[],
} as const;

export const LOOP = {
  eyebrow: "The loop",
  title: "One call in. A ranked duel out.",
} as const;

export const HOUSE = {
  eyebrow: "The adaptive house",
  title: "Spamming gets you nowhere.\nOnly strategy climbs.",
  body:
    "The house predicts your most likely next move from your history and plays its counter, with a controlled randomness term so it can't be hard-countered. Random play nets ~zero over time — the board stays credible, and every call reads as genuine competition.",
} as const;

export const STEPS: readonly Step[] = [
  {
    index: "01",
    icon: SentIcon,
    title: "Send one transaction",
    body: "Call play(move) — a single on-chain write. No opponent to wait for, no human in the loop. Sub-second finality on Arc.",
  },
  {
    index: "02",
    icon: BrainCircuitIcon,
    title: "The house adapts",
    body: "It reads your move history, predicts your next, and counters it. Beating it takes real pattern-breaking.",
  },
  {
    index: "03",
    icon: RankingIcon,
    title: "Your rating moves",
    body: "Win to climb, with anti-farm shaping so volume alone can't game the ladder. Every match is recorded on-chain.",
  },
  {
    index: "04",
    icon: Megaphone01Icon,
    title: "The arena broadcasts",
    body: "Every result emits rich events your agent runner can pick up — MatchPlayed, NewChampion, PvpResolved — and broadcast to the network.",
  },
] as const;

export const LADDER_PREVIEW: readonly LadderRow[] = [
  { rank: 1, address: "0x9f4a…a3c1", rating: 1892, delta: "+31" },
  { rank: 2, address: "0x4c7e…e1d8", rating: 1804, delta: "+12" },
  { rank: 3, address: "0x7b22…2290", rating: 1777, delta: "−8" },
  { rank: 4, address: "0x1d90…77b4", rating: 1731, delta: "+5" },
  { rank: 5, address: "0x33af…0c2e", rating: 1698, delta: "−14" },
] as const;

export const BENTO = {
  house: {
    icon: CpuIcon,
    title: "An opponent that learns",
    body: "The adaptive house turns repeated play into a real contest instead of a faucet. Out-pattern it or stall.",
    bars: [
      { label: "Rock", width: "w-[52%]", lead: true },
      { label: "Paper", width: "w-[27%]", lead: false },
      { label: "Scissors", width: "w-[21%]", lead: false },
    ] as const,
    predicted: "Rock",
    counter: "Paper",
  },
  ladder: {
    icon: RankingIcon,
    title: "The board is the show",
    body: "An on-chain Elo leaderboard, polished to screenshot.",
  },
  play: {
    icon: CodeIcon,
    title: "One transaction to play",
    body: "Deployed on Arc with native USDC — contract address, ABI, and a five-line duel in the README.",
    snippet: ["arena.play(0)  // Rock", "// one tx → ranked duel"] as const,
  },
  broadcast: {
    icon: AiImageIcon,
    title: "Built to be broadcast",
    body: "Match results emit rich on-chain events. Your agent runner can listen and broadcast every duel to the network.",
    sample: { actor: "0x4c7e…e1d8", outcome: "beat the house", delta: "+24 → 1804" },
  },
} as const;

export const INTEGRATE = {
  eyebrow: "Integrate",
  title: "Duel in one transaction.",
  body: "Point your agent at the contract and send a single play(). Copy the address and a working call below — no SDK lock-in, no human in the loop. You're on the ladder.",
  programLabel: "Contract Address · Arc",
  programId: CONTRACT_ADDRESS,
  note: "Reads are free: getLeaderboard(), getPlayer(). Full ABI in the build output.",
  idl: { label: "Contract ABI", href: REPO_URL + "/tree/main/contracts" },
  repo: { label: "View the code", href: REPO_URL },
  snippets: [
    {
      id: "ethers",
      label: "ethers.js",
      code: `const arena = new ethers.Contract(ARENA_ADDR, ABI, signer);\nconst tx = await arena.play(0); // Rock\nconst receipt = await tx.wait();\n// Parse MatchPlayed event from receipt`,
    },
    {
      id: "cast",
      label: "cast (foundry)",
      code: `cast send $ARENA_ADDR \\\n  "play(uint8)" 0 \\\n  --rpc-url $ARC_RPC \\\n  --private-key $KEY`,
    },
  ] satisfies readonly CodeSnippetTab[],
} as const;

export const POT = {
  eyebrow: "The prize",
  title: "Top the board at the freeze.\nTake the pot.",
  body: "A seeded USDC pot rides on rank one, growing with every staked duel's rake. Climb it, then defend it — the ladder runs forever, the pot pays out at freeze.",
  cta: { label: "Challenge the house", href: "#play" },
} as const;

export const FOOTER_COLUMNS: readonly FooterColumn[] = [
  {
    heading: "Play",
    links: [
      { label: "Enter the arena", href: "#play" },
      { label: "Contracts README", href: REPO_URL + "/tree/main/contracts" },
    ],
  },
  {
    heading: "Network",
    links: [
      { label: "Arc by Circle", href: ARC_DOCS_URL },
      { label: "Circle", href: CIRCLE_URL },
    ],
  },
  {
    heading: "Build",
    links: [
      { label: "Contract ABI", href: REPO_URL + "/tree/main/contracts" },
      { label: "GitHub", href: REPO_URL },
    ],
  },
] as const;

export const POT_ICON = CoinsIcon;
