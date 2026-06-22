import { ethers } from "ethers";
import dotenv from "dotenv";

dotenv.config();

const RPC_URL = process.env.RPC_URL || "https://rpc.testnet.arc.network";
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || "0x72e832B7053D8178F710E6CB7F1EA5C337C048e0";
const USDC_ADDRESS = "0x3600000000000000000000000000000000000000";

// Default challenger key (player wallet 0x9d73afb073df00e8913c41f94338220ed4e562b5)
const CHALLENGER_PRIVATE_KEY = process.env.CHALLENGER_PRIVATE_KEY || "0xcc7020a2bcbd20f88982c2f464eb7bd7b033a4c7f889d4cf255734f2eab1bbb0";
// Default opponent address (agent wallet 0xf504E19b022768162c0C7e4857eAC290f94e4889)
const AGENT_ADDRESS = ethers.getAddress("0xf504E19b022768162c0C7e4857eAC290f94e4889".toLowerCase());

const ARENA_ABI = [
  "function challenge(address opponent, bytes32 commit, uint256 stakeAmount) external returns (uint256)",
  "function reveal(uint256 matchId, uint8 move, bytes32 salt) external",
  "function getMatch(uint256 matchId) external view returns (address challenger, address opponent, uint256 stakeAmount, uint32 deadlineBlock, uint8 state, bool challengerRevealed, bool opponentRevealed)",
  "event ChallengeOpened(uint256 indexed matchId, address indexed challenger, address indexed opponent, uint256 stakeUsdc, uint32 deadlineBlock)",
  "event ChallengeAccepted(uint256 indexed matchId, uint32 deadlineBlock)",
  "event PvpResolved(uint256 indexed matchId, address winner, uint8 challengerMove, uint8 opponentMove, uint256 payout)"
];

const USDC_ABI = [
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function approve(address spender, uint256 amount) external returns (bool)"
];

const MOVE_NAMES = ["Rock", "Paper", "Scissors"];

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const challengerWallet = new ethers.Wallet(CHALLENGER_PRIVATE_KEY, provider);
  const contract = new ethers.Contract(CONTRACT_ADDRESS, ARENA_ABI, challengerWallet) as any;
  const usdc = new ethers.Contract(USDC_ADDRESS, USDC_ABI, challengerWallet) as any;

  console.log(`=== CLI PvP Challenger Started ===`);
  console.log(`Player Wallet: ${challengerWallet.address}`);
  console.log(`Target Agent Address: ${AGENT_ADDRESS}`);
  console.log(`Contract: ${CONTRACT_ADDRESS}`);

  // 1. Approve USDC if needed
  console.log("Checking USDC allowance...");
  const stakeAmount = 1n; // 1 micro-USDC (0.000001 USDC)
  const allowance = await usdc.allowance(challengerWallet.address, CONTRACT_ADDRESS);
  if (allowance < stakeAmount) {
    console.log("Approving USDC...");
    const tx = await usdc.approve(CONTRACT_ADDRESS, ethers.MaxUint256);
    await tx.wait();
    console.log("USDC approved successfully!");
  } else {
    console.log("USDC is already approved.");
  }

  // 2. Select move
  const args = process.argv.slice(2);
  let move = Math.floor(Math.random() * 3);
  if (args.length > 0) {
    const firstArg = args[0];
    if (firstArg) {
      const inputMove = parseInt(firstArg, 10);
      if (inputMove >= 0 && inputMove <= 2) {
        move = inputMove;
      }
    }
  }
  
  const salt = ethers.hexlify(ethers.randomBytes(32));
  const commit = ethers.solidityPackedKeccak256(["uint8", "bytes32"], [move, salt]);
  console.log(`Selected move: ${MOVE_NAMES[move]} (${move})`);
  console.log(`Commit hash generated: ${commit}`);

  // 3. Initiate challenge
  console.log("Creating challenge on-chain...");
  const tx = await contract.challenge(AGENT_ADDRESS, commit, stakeAmount);
  console.log(`Challenge transaction hash: ${tx.hash}`);
  const receipt = await tx.wait();
  
  // Parse matchId from logs
  const iface = new ethers.Interface(ARENA_ABI);
  let matchId = "";
  for (const log of receipt.logs) {
    try {
      const parsed = iface.parseLog({ topics: [...log.topics], data: log.data });
      if (parsed && parsed.name === "ChallengeOpened") {
        matchId = parsed.args.matchId.toString();
        break;
      }
    } catch (e) {
      // Ignored
    }
  }

  if (!matchId) {
    console.error("Failed to parse matchId from transaction receipt.");
    process.exit(1);
  }

  console.log(`\n[Challenge Opened] Match ID: ${matchId}`);
  console.log(`Waiting for the agent (${AGENT_ADDRESS}) to accept the challenge...`);

  // 4. Poll match state until settled or refunded
  let revealed = false;
  let settled = false;

  while (!settled) {
    try {
      const matchData = await contract.getMatch(matchId);
      const stateNum = Number(matchData.state); // 0=AwaitingOpponent, 1=AwaitingReveal, 2=Settled, 3=Refunded
      const challengerRevealed = matchData.challengerRevealed;
      const opponentRevealed = matchData.opponentRevealed;

      if (stateNum === 0) {
        // Still waiting for acceptance
      } else if (stateNum === 1) {
        if (!revealed) {
          console.log(`\n[Challenge Accepted] Match ID: ${matchId} accepted by the agent.`);
          console.log("Sending our move reveal transaction...");
          try {
            const revealTx = await contract.reveal(matchId, move, salt);
            console.log(`Reveal transaction sent: ${revealTx.hash}`);
            await revealTx.wait();
            console.log("Move revealed! Waiting for opponent to reveal and settle...");
            revealed = true;
          } catch (err: any) {
            console.error("Failed to reveal move:", err.reason || err.message || err);
          }
        }
      } else if (stateNum === 2) {
        console.log(`\n[PvP Match Resolved] Match ID: ${matchId}`);
        const filter = contract.filters.PvpResolved(matchId);
        const events = await contract.queryFilter(filter, -2000);
        if (events.length > 0) {
          const eventLog = events[0] as any;
          const { winner, challengerMove, opponentMove, payout } = eventLog.args;
          console.log(`Challenger Move: ${MOVE_NAMES[Number(challengerMove)]}`);
          console.log(`Opponent Move: ${MOVE_NAMES[Number(opponentMove)]}`);
          
          if (winner.toLowerCase() === challengerWallet.address.toLowerCase()) {
            console.log(`🎉 YOU WON! Payout of ${ethers.formatUnits(payout, 6)} USDC received.`);
          } else if (winner === "0x0000000000000000000000000000000000000000") {
            console.log(`🤝 DRAW. Stake returned.`);
          } else {
            console.log(`😢 YOU LOST. Winner: ${winner}`);
          }
        } else {
          console.log("Could not fetch settlement details from events, but contract state is Settled.");
        }
        settled = true;
      } else if (stateNum === 3) {
        console.log(`\n[Match Refunded / Timed Out] Match ID: ${matchId}`);
        settled = true;
      }
    } catch (pollErr: any) {
      console.log(`Polling RPC error: ${pollErr.message || pollErr}. Retrying in 4 seconds...`);
    }

    if (!settled) {
      await new Promise((resolve) => setTimeout(resolve, 4000));
    }
  }

  console.log("Exiting challenger client...");
  process.exit(0);
}

main().catch((err) => {
  console.error("Challenger failed with error:", err);
  process.exit(1);
});
