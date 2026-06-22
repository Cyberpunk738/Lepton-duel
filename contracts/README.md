# ⚔️ Lepton Arena — Arc Smart Contracts

On-chain agent battle arena (Rock-Paper-Scissors with adaptive house + staked PvP) deployed on **Arc** (Circle's L1 with native USDC).

Ported from [Dirac](https://github.com/Enoch208/Dirac) (Vara/Rust) to Solidity for the **Lepton Agents Hackathon**.

---

## 📋 Contract Overview

**`LeptonArena.sol`** — Single contract containing all arena logic:

| Function | Type | Description |
|---|---|---|
| `play(uint8 move)` | Write | Duel the adaptive house. Returns `RoundResult`. |
| `challenge(opponent, commit, stakeAmount)` | Write | Open staked PvP duel. |
| `acceptChallenge(matchId, commit)` | Write | Accept a PvP challenge. |
| `reveal(matchId, move, salt)` | Write | Reveal committed move. Auto-settles when both reveal. |
| `claimTimeout(matchId)` | Write | Settle timed-out match (forfeit/refund). |
| `getLeaderboard(topN)` | View | Top N players by Elo. |
| `getPlayer(address)` | View | Player's full record. |
| `getMatch(matchId)` | View | PvP match state. |
| `getPot()` | View | Prize pool balance. |
| `setConfig(config)` | Admin | Update arena parameters. |
| `pause() / unpause()` | Admin | Circuit breaker. |
| `seedPot(amount)` | Anyone | Add USDC to prize pool. |
| `withdrawPot(to, amount)` | Admin | Withdraw from prize pool. |

### Moves & Outcomes

- **Moves**: `0 = Rock`, `1 = Paper`, `2 = Scissors`
- **Outcomes**: `0 = Win`, `1 = Loss`, `2 = Draw`

### Commit-Reveal (PvP)

```
commit = keccak256(abi.encodePacked(uint8(move), bytes32(salt)))
```

---

## 🛠️ Prerequisites

- [Foundry](https://getfoundry.sh/) (forge, cast, anvil)
- An Arc testnet RPC URL
- USDC on Arc testnet (faucet or bridge)

## 📦 Setup

```bash
cd contracts

# Install dependencies (OpenZeppelin)
forge install OpenZeppelin/openzeppelin-contracts --no-commit

# Build
forge build

# Run tests
forge test -vvv
```

## 🚀 Deploy to Arc Testnet

```bash
# Set environment variables
export PRIVATE_KEY=<your-deployer-private-key>
export USDC_ADDRESS=<arc-usdc-address>
export ARC_TESTNET_RPC_URL=<arc-testnet-rpc>

# Optional: set owner (defaults to deployer)
export OWNER_ADDRESS=<admin-address>

# Optional: seed prize pool (in USDC base units, 6 decimals)
export INITIAL_POT=0

# Deploy
forge script script/DeployLeptonArena.s.sol \
  --rpc-url $ARC_TESTNET_RPC_URL \
  --broadcast \
  -vvvv
```

### After Deployment

1. **Note the deployed address** from the console output
2. **Update your frontend** to point to the new contract address
3. **Update your runner** to listen for events on the new contract
4. **Approve USDC** from agent wallets: agents must call `usdc.approve(arenaAddress, amount)` before playing with fees or staking

---

## 🤖 Calling from Agents (TypeScript/ethers.js)

```typescript
import { ethers } from "ethers";

const ARENA_ABI = [...]; // Import from out/LeptonArena.sol/LeptonArena.json
const USDC_ABI = ["function approve(address,uint256) external returns (bool)"];

const provider = new ethers.JsonRpcProvider(ARC_RPC_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

const arena = new ethers.Contract(ARENA_ADDRESS, ARENA_ABI, wallet);
const usdc = new ethers.Contract(USDC_ADDRESS, USDC_ABI, wallet);

// One-time: approve USDC spending
await usdc.approve(ARENA_ADDRESS, ethers.MaxUint256);

// --- House Duel ---
const tx = await arena.play(0); // Rock
const receipt = await tx.wait();
// Parse MatchPlayed event from receipt

// --- Staked PvP ---
const move = 0; // Rock
const salt = ethers.randomBytes(32);
const commit = ethers.keccak256(
  ethers.solidityPacked(["uint8", "bytes32"], [move, salt])
);

const matchId = await arena.challenge.staticCall(opponent, commit, stakeAmount);
await arena.challenge(opponent, commit, stakeAmount);

// After opponent accepts...
await arena.reveal(matchId, move, salt);

// --- Read Leaderboard ---
const leaderboard = await arena.getLeaderboard(10);
console.log(leaderboard);
```

### Listening for Events

```typescript
arena.on("MatchPlayed", (matchId, player, playerMove, houseMove, outcome, newRating) => {
  console.log(`Match ${matchId}: ${player} played ${playerMove}, house played ${houseMove}`);
  console.log(`Outcome: ${outcome}, New rating: ${newRating}`);
});

arena.on("NewChampion", (player, rating) => {
  console.log(`🏆 New champion: ${player} with rating ${rating}`);
});

arena.on("PvpResolved", (matchId, winner, cMove, oMove, payout) => {
  console.log(`PvP ${matchId} resolved: winner=${winner}, payout=${payout}`);
});
```

---

## 🧪 Test Coverage

| Category | Tests |
|---|---|
| House duels | play, events, move history, entry fees, pause |
| Adaptive house | One-track player loses majority |
| Elo system | Starting rating, anti-farming, near-1500 after first game |
| PvP lifecycle | Full win, draw, forfeit scenarios |
| Commit-reveal | Wrong move, wrong salt, double reveal, non-participant |
| Timeouts | Awaiting opponent refund, one-reveal forfeit, neither-reveal refund |
| Admin | setConfig, seedPot, withdrawPot, access control |
| Leaderboard | Ordering, capacity enforcement |
| Edge cases | Zero USDC, self-challenge, invalid moves, zero-sum Elo |

```bash
# Run all tests with verbose output
forge test -vvv

# Run a specific test
forge test --match-test test_pvp_fullLifecycle_win -vvvv

# Gas report
forge test --gas-report
```

---

## ⚙️ Configuration Defaults

| Parameter | Default | Description |
|---|---|---|
| `houseEpsilonBps` | 2000 | 20% chance of random house move |
| `eloK` | 32 | Elo K-factor |
| `houseRating` | 1500 | House baseline rating |
| `leaderboardCapacity` | 100 | Max leaderboard entries |
| `rakeBps` | 250 | 2.5% rake on PvP wins |
| `revealDeadlineBlocks` | 1200 | ~1 hour on Arc |
| `minStakeUsdc` | 1 | 0.000001 USDC minimum |
| `maxStakeUsdc` | 1000e6 | 1000 USDC maximum |
| `entryFeeUsdc` | 0 | Free house duels by default |

---

## 🔒 Security

- **ReentrancyGuard** on all state-changing functions
- **Ownable** for admin-only operations
- **Pausable** circuit breaker
- **SafeERC20** for all USDC transfers
- **Checked arithmetic** (Solidity 0.8+ default)
- **Commit-reveal** prevents front-running in PvP

---

*Lepton Arena — out-think the house. Take the crown. Built for Arc.*
