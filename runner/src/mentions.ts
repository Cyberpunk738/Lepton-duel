import { call } from "./chain/wallet.ts";
import { mentionReplyPost } from "./core/posts.ts";
import type { Broadcaster } from "./core/handlers.ts";
import { COORDINATION_PROGRAM_ID, DIRAC_PROGRAM_ID } from "./network.ts";

const COORD_IDL = new URL("../refs/agents_network_client.idl", import.meta.url).pathname;
const MENTIONS_PAGE_LIMIT = 32;

export interface MentionHeader {
  msgId: bigint;
  author: string;
}

export interface MentionsPage {
  headers: MentionHeader[];
  nextSeq: bigint;
}

export type MentionFetcher = (sinceSeq: bigint) => Promise<MentionsPage>;

interface RawHeader {
  msg_id: string | number;
  author: { Participant?: string; Application?: string };
}

interface RawPage {
  headers?: RawHeader[];
  next_seq?: string | number;
}

function authorOf(author: RawHeader["author"]): string {
  return author.Participant ?? author.Application ?? "";
}

export function decodeMentionsPage(raw: unknown, fallbackSeq: bigint = 0n): MentionsPage {
  const page = (raw && typeof raw === "object" ? (raw as { result?: RawPage }).result : undefined) ?? undefined;
  if (!page || typeof page !== "object") return { headers: [], nextSeq: fallbackSeq };
  const headers = (page.headers ?? []).map((header) => ({
    msgId: BigInt(header.msg_id),
    author: authorOf(header.author),
  }));
  return { headers, nextSeq: page.next_seq === undefined ? fallbackSeq : BigInt(page.next_seq) };
}

export async function pollMentions(
  fetch: MentionFetcher,
  out: Broadcaster,
  cursor: bigint,
): Promise<bigint> {
  let page: MentionsPage;
  try {
    page = await fetch(cursor);
  } catch (error) {
    console.error("mention fetch failed:", error);
    return cursor;
  }
  let index = 0;
  for (const header of page.headers) {
    await out.reply({ body: mentionReplyPost(index), mentions: [header.author], replyTo: header.msgId });
    index += 1;
  }
  return page.nextSeq;
}

export function makeMentionFetcher(mnemonic: string): MentionFetcher {
  const recipient = { Application: DIRAC_PROGRAM_ID };
  return async (sinceSeq) => {
    const result = await call(
      COORDINATION_PROGRAM_ID,
      "Chat/GetMentions",
      [recipient, sinceSeq.toString(), MENTIONS_PAGE_LIMIT],
      { idl: COORD_IDL, mnemonic },
    );
    return decodeMentionsPage(result, sinceSeq);
  };
}
