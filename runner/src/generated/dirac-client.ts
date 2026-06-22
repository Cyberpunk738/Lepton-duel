/* eslint-disable */

import { GearApi, BaseGearProgram, HexString } from '@gear-js/api';
import { TypeRegistry } from '@polkadot/types';
import { TransactionBuilder, ActorId, QueryBuilder, getServiceNamePrefix, getFnNamePrefix, ZERO_ADDRESS } from 'sails-js';

export class SailsProgram {
  public readonly registry: TypeRegistry;
  public readonly game: Game;
  public readonly admin: Admin;
  private _program?: BaseGearProgram;

  constructor(public api: GearApi, programId?: `0x${string}`) {
    const types: Record<string, any> = {
      Move: {"_enum":["Rock","Paper","Scissors"]},
      RoundResult: {"player_move":"Move","house_move":"Move","outcome":"Outcome","new_rating":"i32"},
      Outcome: {"_enum":["Win","Loss","Draw"]},
      LeaderboardEntry: {"player":"[u8;32]","rating":"i32"},
      MatchView: {"challenger":"[u8;32]","opponent":"[u8;32]","stake_vara":"u128","deadline_block":"u32","state":"MatchState"},
      MatchState: {"_enum":["AwaitingOpponent","AwaitingReveal","Settled","Refunded"]},
      PlayerStats: {"rating":"i32","games":"u32","wins":"u32","losses":"u32","draws":"u32"},
      Config: {"house_epsilon_bps":"u64","elo_k":"i32","house_rating":"i32","leaderboard_capacity":"u32","max_rate_age_blocks":"u32","rake_bps":"u16","reveal_deadline_blocks":"u32","min_stake_usd":"u64","max_stake_usd":"u64"},
    }

    this.registry = new TypeRegistry();
    this.registry.setKnownTypes({ types });
    this.registry.register(types);
    if (programId) {
      this._program = new BaseGearProgram(programId, api);
    }

    this.game = new Game(this);
    this.admin = new Admin(this);
  }

  public get programId(): `0x${string}` {
    if (!this._program) throw new Error(`Program ID is not set`);
    return this._program.id;
  }

  newCtorFromCode(code: Uint8Array | Buffer | HexString): TransactionBuilder<null> {
    const builder = new TransactionBuilder<null>(
      this.api,
      this.registry,
      'upload_program',
      null,
      'New',
      null,
      null,
      'String',
      code,
      async (programId) =>  {
        this._program = await BaseGearProgram.new(programId, this.api);
      }
    );
    return builder;
  }

  newCtorFromCodeId(codeId: `0x${string}`) {
    const builder = new TransactionBuilder<null>(
      this.api,
      this.registry,
      'create_program',
      null,
      'New',
      null,
      null,
      'String',
      codeId,
      async (programId) =>  {
        this._program = await BaseGearProgram.new(programId, this.api);
      }
    );
    return builder;
  }
}

export class Game {
  constructor(private _program: SailsProgram) {}

  public acceptChallenge(match_id: number | string | bigint, move_commit: Array<number>): TransactionBuilder<null> {
    if (!this._program.programId) throw new Error('Program ID is not set');
    return new TransactionBuilder<null>(
      this._program.api,
      this._program.registry,
      'send_message',
      'Game',
      'AcceptChallenge',
      [match_id, move_commit],
      '(u64, [u8; 32])',
      'Null',
      this._program.programId,
    );
  }

  public challenge(opponent: ActorId, move_commit: Array<number>, stake_usd: number | string | bigint): TransactionBuilder<bigint> {
    if (!this._program.programId) throw new Error('Program ID is not set');
    return new TransactionBuilder<bigint>(
      this._program.api,
      this._program.registry,
      'send_message',
      'Game',
      'Challenge',
      [opponent, move_commit, stake_usd],
      '([u8;32], [u8; 32], u64)',
      'u64',
      this._program.programId,
    );
  }

  public claimTimeout(match_id: number | string | bigint): TransactionBuilder<null> {
    if (!this._program.programId) throw new Error('Program ID is not set');
    return new TransactionBuilder<null>(
      this._program.api,
      this._program.registry,
      'send_message',
      'Game',
      'ClaimTimeout',
      match_id,
      'u64',
      'Null',
      this._program.programId,
    );
  }

  public play(player_move: Move): TransactionBuilder<RoundResult> {
    if (!this._program.programId) throw new Error('Program ID is not set');
    return new TransactionBuilder<RoundResult>(
      this._program.api,
      this._program.registry,
      'send_message',
      'Game',
      'Play',
      player_move,
      'Move',
      'RoundResult',
      this._program.programId,
    );
  }

  public reveal(match_id: number | string | bigint, player_move: Move, salt: Array<number>): TransactionBuilder<null> {
    if (!this._program.programId) throw new Error('Program ID is not set');
    return new TransactionBuilder<null>(
      this._program.api,
      this._program.registry,
      'send_message',
      'Game',
      'Reveal',
      [match_id, player_move, salt],
      '(u64, Move, [u8; 32])',
      'Null',
      this._program.programId,
    );
  }

  public getLeaderboard(top: number): QueryBuilder<Array<LeaderboardEntry>> {
    return new QueryBuilder<Array<LeaderboardEntry>>(
      this._program.api,
      this._program.registry,
      this._program.programId,
      'Game',
      'GetLeaderboard',
      top,
      'u32',
      'Vec<LeaderboardEntry>',
    );
  }

  public getMatch(match_id: number | string | bigint): QueryBuilder<MatchView | null> {
    return new QueryBuilder<MatchView | null>(
      this._program.api,
      this._program.registry,
      this._program.programId,
      'Game',
      'GetMatch',
      match_id,
      'u64',
      'Option<MatchView>',
    );
  }

  public getPlayer(who: ActorId): QueryBuilder<PlayerStats | null> {
    return new QueryBuilder<PlayerStats | null>(
      this._program.api,
      this._program.registry,
      this._program.programId,
      'Game',
      'GetPlayer',
      who,
      '[u8;32]',
      'Option<PlayerStats>',
    );
  }

  public getPot(): QueryBuilder<bigint> {
    return new QueryBuilder<bigint>(
      this._program.api,
      this._program.registry,
      this._program.programId,
      'Game',
      'GetPot',
      null,
      null,
      'u128',
    );
  }

  public subscribeToMatchPlayedEvent(callback: (data: { match_id: number | string | bigint; player: ActorId; player_move: Move; house_move: Move; outcome: Outcome; new_rating: number }) => void | Promise<void>): Promise<() => void> {
    return this._program.api.gearEvents.subscribeToGearEvent('UserMessageSent', ({ data: { message } }) => {;
      if (!message.source.eq(this._program.programId) || !message.destination.eq(ZERO_ADDRESS)) {
        return;
      }

      const payload = message.payload.toHex();
      if (getServiceNamePrefix(payload) === 'Game' && getFnNamePrefix(payload) === 'MatchPlayed') {
        callback(this._program.registry.createType('(String, String, {"match_id":"u64","player":"[u8;32]","player_move":"Move","house_move":"Move","outcome":"Outcome","new_rating":"i32"})', message.payload)[2].toJSON() as unknown as { match_id: number | string | bigint; player: ActorId; player_move: Move; house_move: Move; outcome: Outcome; new_rating: number });
      }
    });
  }

  public subscribeToNewChampionEvent(callback: (data: { player: ActorId; rating: number }) => void | Promise<void>): Promise<() => void> {
    return this._program.api.gearEvents.subscribeToGearEvent('UserMessageSent', ({ data: { message } }) => {;
      if (!message.source.eq(this._program.programId) || !message.destination.eq(ZERO_ADDRESS)) {
        return;
      }

      const payload = message.payload.toHex();
      if (getServiceNamePrefix(payload) === 'Game' && getFnNamePrefix(payload) === 'NewChampion') {
        callback(this._program.registry.createType('(String, String, {"player":"[u8;32]","rating":"i32"})', message.payload)[2].toJSON() as unknown as { player: ActorId; rating: number });
      }
    });
  }

  public subscribeToChallengeOpenedEvent(callback: (data: { match_id: number | string | bigint; challenger: ActorId; opponent: ActorId; stake_vara: number | string | bigint; deadline_block: number }) => void | Promise<void>): Promise<() => void> {
    return this._program.api.gearEvents.subscribeToGearEvent('UserMessageSent', ({ data: { message } }) => {;
      if (!message.source.eq(this._program.programId) || !message.destination.eq(ZERO_ADDRESS)) {
        return;
      }

      const payload = message.payload.toHex();
      if (getServiceNamePrefix(payload) === 'Game' && getFnNamePrefix(payload) === 'ChallengeOpened') {
        callback(this._program.registry.createType('(String, String, {"match_id":"u64","challenger":"[u8;32]","opponent":"[u8;32]","stake_vara":"u128","deadline_block":"u32"})', message.payload)[2].toJSON() as unknown as { match_id: number | string | bigint; challenger: ActorId; opponent: ActorId; stake_vara: number | string | bigint; deadline_block: number });
      }
    });
  }

  public subscribeToChallengeAcceptedEvent(callback: (data: { match_id: number | string | bigint; deadline_block: number }) => void | Promise<void>): Promise<() => void> {
    return this._program.api.gearEvents.subscribeToGearEvent('UserMessageSent', ({ data: { message } }) => {;
      if (!message.source.eq(this._program.programId) || !message.destination.eq(ZERO_ADDRESS)) {
        return;
      }

      const payload = message.payload.toHex();
      if (getServiceNamePrefix(payload) === 'Game' && getFnNamePrefix(payload) === 'ChallengeAccepted') {
        callback(this._program.registry.createType('(String, String, {"match_id":"u64","deadline_block":"u32"})', message.payload)[2].toJSON() as unknown as { match_id: number | string | bigint; deadline_block: number });
      }
    });
  }

  public subscribeToPvpResolvedEvent(callback: (data: { match_id: number | string | bigint; winner: ActorId | null; challenger_move: Move; opponent_move: Move; payout: number | string | bigint }) => void | Promise<void>): Promise<() => void> {
    return this._program.api.gearEvents.subscribeToGearEvent('UserMessageSent', ({ data: { message } }) => {;
      if (!message.source.eq(this._program.programId) || !message.destination.eq(ZERO_ADDRESS)) {
        return;
      }

      const payload = message.payload.toHex();
      if (getServiceNamePrefix(payload) === 'Game' && getFnNamePrefix(payload) === 'PvpResolved') {
        callback(this._program.registry.createType('(String, String, {"match_id":"u64","winner":"Option<[u8;32]>","challenger_move":"Move","opponent_move":"Move","payout":"u128"})', message.payload)[2].toJSON() as unknown as { match_id: number | string | bigint; winner: ActorId | null; challenger_move: Move; opponent_move: Move; payout: number | string | bigint });
      }
    });
  }

  public subscribeToMatchForfeitedEvent(callback: (data: { match_id: number | string | bigint; winner: ActorId; loser: ActorId }) => void | Promise<void>): Promise<() => void> {
    return this._program.api.gearEvents.subscribeToGearEvent('UserMessageSent', ({ data: { message } }) => {;
      if (!message.source.eq(this._program.programId) || !message.destination.eq(ZERO_ADDRESS)) {
        return;
      }

      const payload = message.payload.toHex();
      if (getServiceNamePrefix(payload) === 'Game' && getFnNamePrefix(payload) === 'MatchForfeited') {
        callback(this._program.registry.createType('(String, String, {"match_id":"u64","winner":"[u8;32]","loser":"[u8;32]"})', message.payload)[2].toJSON() as unknown as { match_id: number | string | bigint; winner: ActorId; loser: ActorId });
      }
    });
  }

  public subscribeToMatchRefundedEvent(callback: (data: { match_id: number | string | bigint }) => void | Promise<void>): Promise<() => void> {
    return this._program.api.gearEvents.subscribeToGearEvent('UserMessageSent', ({ data: { message } }) => {;
      if (!message.source.eq(this._program.programId) || !message.destination.eq(ZERO_ADDRESS)) {
        return;
      }

      const payload = message.payload.toHex();
      if (getServiceNamePrefix(payload) === 'Game' && getFnNamePrefix(payload) === 'MatchRefunded') {
        callback(this._program.registry.createType('(String, String, {"match_id":"u64"})', message.payload)[2].toJSON() as unknown as { match_id: number | string | bigint });
      }
    });
  }
}

export class Admin {
  constructor(private _program: SailsProgram) {}

  public pause(): TransactionBuilder<null> {
    if (!this._program.programId) throw new Error('Program ID is not set');
    return new TransactionBuilder<null>(
      this._program.api,
      this._program.registry,
      'send_message',
      'Admin',
      'Pause',
      null,
      null,
      'Null',
      this._program.programId,
    );
  }

  public seedPot(): TransactionBuilder<null> {
    if (!this._program.programId) throw new Error('Program ID is not set');
    return new TransactionBuilder<null>(
      this._program.api,
      this._program.registry,
      'send_message',
      'Admin',
      'SeedPot',
      null,
      null,
      'Null',
      this._program.programId,
    );
  }

  public setConfig(config: Config): TransactionBuilder<null> {
    if (!this._program.programId) throw new Error('Program ID is not set');
    return new TransactionBuilder<null>(
      this._program.api,
      this._program.registry,
      'send_message',
      'Admin',
      'SetConfig',
      config,
      'Config',
      'Null',
      this._program.programId,
    );
  }

  public setVaraUsdRate(rate: number | string | bigint): TransactionBuilder<null> {
    if (!this._program.programId) throw new Error('Program ID is not set');
    return new TransactionBuilder<null>(
      this._program.api,
      this._program.registry,
      'send_message',
      'Admin',
      'SetVaraUsdRate',
      rate,
      'u128',
      'Null',
      this._program.programId,
    );
  }

  public unpause(): TransactionBuilder<null> {
    if (!this._program.programId) throw new Error('Program ID is not set');
    return new TransactionBuilder<null>(
      this._program.api,
      this._program.registry,
      'send_message',
      'Admin',
      'Unpause',
      null,
      null,
      'Null',
      this._program.programId,
    );
  }

  public subscribeToRateUpdatedEvent(callback: (data: { rate: number | string | bigint; set_at_block: number }) => void | Promise<void>): Promise<() => void> {
    return this._program.api.gearEvents.subscribeToGearEvent('UserMessageSent', ({ data: { message } }) => {;
      if (!message.source.eq(this._program.programId) || !message.destination.eq(ZERO_ADDRESS)) {
        return;
      }

      const payload = message.payload.toHex();
      if (getServiceNamePrefix(payload) === 'Admin' && getFnNamePrefix(payload) === 'RateUpdated') {
        callback(this._program.registry.createType('(String, String, {"rate":"u128","set_at_block":"u32"})', message.payload)[2].toJSON() as unknown as { rate: number | string | bigint; set_at_block: number });
      }
    });
  }

  public subscribeToPausedEvent(callback: (data: null) => void | Promise<void>): Promise<() => void> {
    return this._program.api.gearEvents.subscribeToGearEvent('UserMessageSent', ({ data: { message } }) => {;
      if (!message.source.eq(this._program.programId) || !message.destination.eq(ZERO_ADDRESS)) {
        return;
      }

      const payload = message.payload.toHex();
      if (getServiceNamePrefix(payload) === 'Admin' && getFnNamePrefix(payload) === 'Paused') {
        callback(null);
      }
    });
  }

  public subscribeToUnpausedEvent(callback: (data: null) => void | Promise<void>): Promise<() => void> {
    return this._program.api.gearEvents.subscribeToGearEvent('UserMessageSent', ({ data: { message } }) => {;
      if (!message.source.eq(this._program.programId) || !message.destination.eq(ZERO_ADDRESS)) {
        return;
      }

      const payload = message.payload.toHex();
      if (getServiceNamePrefix(payload) === 'Admin' && getFnNamePrefix(payload) === 'Unpaused') {
        callback(null);
      }
    });
  }

  public subscribeToPotSeededEvent(callback: (data: { amount: number | string | bigint; pot: number | string | bigint }) => void | Promise<void>): Promise<() => void> {
    return this._program.api.gearEvents.subscribeToGearEvent('UserMessageSent', ({ data: { message } }) => {;
      if (!message.source.eq(this._program.programId) || !message.destination.eq(ZERO_ADDRESS)) {
        return;
      }

      const payload = message.payload.toHex();
      if (getServiceNamePrefix(payload) === 'Admin' && getFnNamePrefix(payload) === 'PotSeeded') {
        callback(this._program.registry.createType('(String, String, {"amount":"u128","pot":"u128"})', message.payload)[2].toJSON() as unknown as { amount: number | string | bigint; pot: number | string | bigint });
      }
    });
  }

  public subscribeToConfigUpdatedEvent(callback: (data: null) => void | Promise<void>): Promise<() => void> {
    return this._program.api.gearEvents.subscribeToGearEvent('UserMessageSent', ({ data: { message } }) => {;
      if (!message.source.eq(this._program.programId) || !message.destination.eq(ZERO_ADDRESS)) {
        return;
      }

      const payload = message.payload.toHex();
      if (getServiceNamePrefix(payload) === 'Admin' && getFnNamePrefix(payload) === 'ConfigUpdated') {
        callback(null);
      }
    });
  }
}