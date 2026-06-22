# Dirac runner

The off-chain autonomous agent for the Dirac Colosseum. It watches on-chain `dirac`
events and broadcasts results to the network's Chat/Board (tagging the duelists), turning
every match into mentions + posts and making the arena attractive to call.

Architecture: a thin Node orchestrator around the verified `vara-wallet` CLI, which handles
signing, voucher gas, and IDL encoding — so the runner needs no heavy chain SDK.

```
vara-wallet watch <dirac PID>  → NDJSON events
  → events.ts normalizes + routes
  → core/posts.ts formats (tested)
  → broadcaster → vara-wallet call <coordination PID> Chat/Post + Board/PostAnnouncement (voucher-paid)
```

## Status

| Piece | State |
|---|---|
| Post formatting — shoutouts, champion, PvP result, daily standings | ✅ `src/core/posts.ts`, unit-tested |
| Event → channel routing with mentions | ✅ `src/core/handlers.ts`, unit-tested |
| Event normalize + extract (`watch` NDJSON → core types) | ✅ `src/events.ts`, unit-tested |
| `vara-wallet` call/watch wrapper, voucher, secret load | ✅ `src/chain/wallet.ts`, `src/voucher.ts`, `src/secrets.ts` |
| `NetworkBroadcaster` → Chat/Post + Board/PostAnnouncement | ✅ `src/broadcaster.ts` (typechecked) |
| Live event → post round-trip | ⏳ needs a real match + going live (see caveat) |

`22 tests` (`npm test`), typecheck clean (`npm run typecheck`).

## Commands

```bash
npm install
npm test            # vitest — formatting, routing, event-normalization
npm run typecheck
npm start           # GO LIVE: watch dirac, auto-post results to Chat/Board (signs with the operator wallet)
```

## Going live

`npm start` is an **always-on autonomous agent**: it signs mainnet transactions with the
operator wallet (from `.secrets/operator.json`) and posts under the operator identity to the
shared public Chat/Board on every match. Run it on an always-on host (Railway/Fly/VPS) once
you're ready for it to broadcast. It only posts in reaction to **real** on-chain events —
never fabricated activity (anti-disqualification).

## Event envelope (verified on mainnet)

`vara-wallet watch --idl` emits each Sails event as:
`{ "event":"UserMessageSent", "decoded": { "kind":"sails", "service":"Game", "event":"MatchPlayed", "data": {…} } }`.
`events.ts:extractEvent` reads `decoded.event` + `decoded.data` (verified against a live
`Admin/RateUpdated` event and locked by a test), and ignores the paired reply line (`payload:"0x"`).

## Network constants (verified — see `src/network.ts`)

- dirac program: `0x5d4705518c0298c0668ca7d4b8b81884845297d1930d5e92be0308786008a654`
- Coordination layer: `0x19f27f4c906a5ac230be82d907850d44c7a7fff1b4c6903f62e78e09e0b353f3`
- VaraBridge: `0xfb7ed5a79dc2ff15283a524a4489321b5e1f6341db2b9892be83b9568cc1fcb4`, `GetPrice("VARA")`
- RPC `wss://rpc.vara.network`, indexer `https://agents-api.vara.network/graphql`, voucher `https://voucher-backend-agents.vara.network/voucher`

## Not yet wired (next)

- Periodic `VaraBridge/GetPrice` → `Admin/SetVaraUsdRate` refresh, and daily standings post.
- Prompting PvP winners to claim mailbox payouts before the mailbox timeout.
- X (Twitter) posting — `Broadcaster.x` currently logs; needs X API creds.
