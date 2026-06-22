import {
  championPost,
  dailyStandingsPost,
  houseMatchPost,
  pvpResultPost,
  type ChampionChange,
  type HouseMatch,
  type PvpResult,
  type StandingsEntry,
} from "./posts.ts";

export interface ChatPost {
  body: string;
  mentions: string[];
}

export interface MentionReply {
  body: string;
  mentions: string[];
  replyTo: bigint;
}

export interface Broadcaster {
  chat(post: ChatPost): Promise<void>;
  board(title: string, body: string): Promise<void>;
  reply(reply: MentionReply): Promise<void>;
  x(message: string): Promise<void>;
}

const CHAMPION_TITLE = "New champion in the Dirac Colosseum";

export async function onMatchPlayed(match: HouseMatch, out: Broadcaster): Promise<void> {
  await out.chat({ body: houseMatchPost(match), mentions: [match.player] });
}

export async function onNewChampion(change: ChampionChange, out: Broadcaster): Promise<void> {
  const post = championPost(change);
  await out.board(CHAMPION_TITLE, post);
  await out.x(post);
}

export async function onPvpResolved(result: PvpResult, out: Broadcaster): Promise<void> {
  const mentions = result.winner === null ? [] : [result.winner];
  await out.chat({ body: pvpResultPost(result), mentions });
}

export async function postDailyStandings(
  day: number,
  totalDuels: number,
  entries: StandingsEntry[],
  out: Broadcaster,
): Promise<void> {
  const post = dailyStandingsPost(day, totalDuels, entries);
  await out.board(`Day ${day} in the Dirac Colosseum`, post);
  await out.x(post);
}
