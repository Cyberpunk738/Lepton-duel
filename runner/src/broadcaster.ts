import { call, type CallOptions, type CallResult } from "./chain/wallet.ts";
import type { Broadcaster, ChatPost, MentionReply } from "./core/handlers.ts";
import { COORDINATION_PROGRAM_ID, DIRAC_PROGRAM_ID } from "./network.ts";

const COORD_IDL = new URL("../refs/agents_network_client.idl", import.meta.url).pathname;
const BOARD_TAGS = ["dirac", "game", "rps", "arena"];

export type Caller = (
  programId: string,
  method: string,
  args: unknown[],
  opts: CallOptions,
) => Promise<CallResult>;

export interface BroadcasterConfig {
  mnemonic: string;
  voucher: string;
}

export class NetworkBroadcaster implements Broadcaster {
  constructor(
    private readonly config: BroadcasterConfig,
    private readonly caller: Caller = call,
  ) {}

  async chat(post: ChatPost): Promise<void> {
    const author = { Application: DIRAC_PROGRAM_ID };
    const mentions = post.mentions.map((address) => ({ Participant: address }));
    if (await this.post(post.body, author, mentions)) return;
    if (mentions.length > 0) {
      await this.post(post.body, author, []);
    }
  }

  async reply(reply: MentionReply): Promise<void> {
    const author = { Application: DIRAC_PROGRAM_ID };
    const mentions = reply.mentions.map((address) => ({ Participant: address }));
    if (await this.post(reply.body, author, mentions, undefined, reply.replyTo)) return;
    if (mentions.length > 0) {
      await this.post(reply.body, author, [], undefined, reply.replyTo);
    }
  }

  async board(title: string, body: string): Promise<void> {
    await this.post(title, undefined, undefined, body);
  }

  async x(message: string): Promise<void> {
    console.log(`[x] ${message}`);
  }

  private async post(
    bodyOrTitle: string,
    author?: { Application: string },
    mentions?: { Participant: string }[],
    announcementBody?: string,
    replyTo?: bigint,
  ): Promise<boolean> {
    const isChat = author !== undefined;
    const method = isChat ? "Chat/Post" : "Board/PostAnnouncement";
    const args = isChat
      ? [bodyOrTitle, author, mentions ?? [], replyTo === undefined ? null : replyTo.toString()]
      : [DIRAC_PROGRAM_ID, { title: bodyOrTitle, body: announcementBody ?? "", tags: BOARD_TAGS }];
    try {
      const result = await this.caller(COORDINATION_PROGRAM_ID, method, args, {
        idl: COORD_IDL,
        mnemonic: this.config.mnemonic,
        voucher: this.config.voucher,
      });
      const failed = result.reason === "panic" || Boolean(result.error) || !result.txHash;
      if (failed) console.error(`${method} rejected:`, result.error ?? result.reason ?? "no txHash");
      return !failed;
    } catch (error) {
      console.error(`${method} failed:`, error);
      return false;
    }
  }
}
