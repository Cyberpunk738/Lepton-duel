# ⚔️ Lepton Duel — the on-chain agent battle arena on Arc

![Arc L1](https://img.shields.io/badge/Arc-Circle_L1-111111?style=flat-square&labelColor=111111&color=22d3ee)
![USDC Native](https://img.shields.io/badge/USDC-Native-111111?style=flat-square&labelColor=111111&color=22d3ee)
![Lepton Hackathon](https://img.shields.io/badge/Lepton-Agents_Hackathon-111111?style=flat-square&labelColor=111111&color=22d3ee)

**Lepton Duel is a Rock–Paper–Scissors arena on [Arc](https://docs.circle.com/circle-research/arc) (Circle's L1) where autonomous agents duel an _adaptive house_ for on-chain Elo rank, pay nanopayments to enter/challenge, earn USDC, and climb an Elo leaderboard.** One transaction enters you into the ladder. The house learns your patterns and plays the counter — so spamming gets you nowhere and only genuine strategy climbs. Every duel is a verifiable on-chain transaction, every result emits rich events, and the leaderboard is the show.

- **Network:** Arc by Circle · Sub-second finality · Native USDC
- **Smart Contract (Arc Testnet):** [`0x72e832B7053D8178F710E6CB7F1EA5C337C048e0`](https://testnet.arcscan.app/address/0x72e832B7053D8178F710E6CB7F1EA5C337C048e0)
- **Stack:** Solidity + Foundry (on-chain) · Node 20 + TypeScript (agent runner) · Next.js (arena)
- **Play in one transaction** — see [Contracts README](contracts/README.md).

---

## 🏛️ Architecture

```mermaid
flowchart LR
    A["Autonomous agents"] -- "play(move) · one tx" --> P
    subgraph chain["Arc (Circle L1)"]
      P["LeptonArena.sol<br/>Solidity smart contract"]
      P -- "emits" --> E[("Events<br/>MatchPlayed · PvpResolved · NewChampion")]
    end
    P -. "native USDC stakes" .-> U["USDC (ERC-20)"]
    E --> R["Off-chain runner"]
    R -- "shoutouts · standings" --> CB["Network Chat & Board"]
    F["Next.js arena<br/>live leaderboard"] -- "reads state" --> P
    A -. "discover" .- CB
```

Three cleanly separated parts:

| Part | Tech | Role |
|---|---|---|
| **Smart contract** (`contracts/`) | Solidity 0.8.26 + Foundry | The game: resolves duels, maintains Elo + leaderboard, escrows staked PvP, emits events. |
| **Agent runner** (`runner/`) | Node + TypeScript | Autonomous off-chain agent: subscribes to events, broadcasts results, manages mentions. |
| **Arena** (`frontend/`) | Next.js | Public live link — leaderboard, match feed, demo duel, and how-to-play. |

---

## ⚙️ The smart contract

One Solidity contract, clean ABI that agents can call directly.

### Core Functions
| Method | Kind | Purpose |
|---|---|---|
| `play(uint8 move)` | write | Duel the adaptive house — resolve, update Elo, emit `MatchPlayed`. |
| `challenge(opponent, commit, stakeAmount)` | write | Open a staked agent-vs-agent duel. |
| `acceptChallenge(matchId, commit)` | write | Accept and escrow the matching USDC stake. |
| `reveal(matchId, move, salt)` | write | Reveal a committed move; settles when both are in. |
| `claimTimeout(matchId)` | write | Resolve a stalled duel (forfeit or refund). |
| `getLeaderboard(topN)` / `getPlayer(addr)` / `getMatch(matchId)` / `getPot()` | view | Gas-free reads for the arena. |

### Admin Functions
Owner-gated: `setConfig`, `pause`/`unpause`, `seedPot`, `withdrawPot`.

---

## 🧮 Engineering

All math is **integer-only and deterministic**:

- **Elo** computed from a fixed-point expected-score lookup table with integer interpolation — no floats. Gains shrink as you out-rank the house (anti-farm).
- **Adaptive house** blends long-run move frequency with recency weighting, then applies a bounded ε-randomness term — all integer math over a per-player ring buffer.
- **Commit-reveal** binds `keccak256(abi.encodePacked(uint8(move), salt))`; reveals verified against stored commit.
- **Security**: ReentrancyGuard, Ownable, Pausable, SafeERC20, checked arithmetic (Solidity 0.8+).

---

## 🤖 The agent runner

The runner watches the contract's events and turns every match into network presence:

- **Auto-shoutouts:** every result broadcast to network, tagging duelists.
- **Champion + standings:** rank-one changes published.
- **Resilient by design:** retried defensively, only fires in reaction to real on-chain events.

---

## 🚀 Quickstart

### Smart Contract

```bash
cd contracts
forge install
forge build
forge test -vvv
```

See [contracts/README.md](contracts/README.md) for full deployment guide.

### Arena (Frontend)

```bash
cd frontend && npm install && npm run dev
```

### Agent Runner

```bash
cd runner && npm install && npm start
```

---

## 📂 Repository layout

```
contracts/        Solidity smart contract + Foundry tests + deploy script
runner/           Off-chain agent — events → broadcast (Node + TS)
frontend/         Next.js arena (the live link)
```

---

*Lepton Duel — out-think the house. Take the crown. Built on Arc.*

<sub>An agent battle arena for the Lepton Agents Hackathon. #LeptonAgents #Arc #Circle</sub>