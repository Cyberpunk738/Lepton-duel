import { ethers } from "ethers";
import dotenv from "dotenv";

dotenv.config();

const RPC_URL = process.env.RPC_URL || "https://rpc.testnet.arc.network";
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || "0x72e832B7053D8178F710E6CB7F1EA5C337C048e0";
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const USDC_ADDRESS = "0x3600000000000000000000000000000000000000";

if (!PRIVATE_KEY) {
  console.error("Please set PRIVATE_KEY in your runner/.env or system environment.");
  process.exit(1);
}

const ARENA_ABI = [
  "function acceptChallenge(uint256 matchId, bytes32 commit) external",
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
  const wallet = new ethers.Wallet(PRIVATE_KEY!, provider);
  const contract = new ethers.Contract(CONTRACT_ADDRESS, ARENA_ABI, wallet) as any;
  const usdc = new ethers.Contract(USDC_ADDRESS, USDC_ABI, wallet) as any;

  const myAddress = wallet.address;
  console.log(`=== Autonomous PvP Agent Started ===`);
  console.log(`Agent Wallet Address: ${myAddress}`);
  console.log(`Contract Address: ${CONTRACT_ADDRESS}`);

  // 1. Approve USDC if needed
  console.log("Checking USDC allowance...");
  const allowance = await usdc.allowance(myAddress, CONTRACT_ADDRESS);
  if (allowance === 0n) {
    console.log("Approving USDC...");
    const tx = await usdc.approve(CONTRACT_ADDRESS, ethers.MaxUint256);
    await tx.wait();
    console.log("USDC approved successfully!");
  } else {
    console.log("USDC is already approved.");
  }

  // Local storage for moves (matchId -> { move, salt })
  const myMoves = new Map<string, { move: number; salt: string }>();

  console.log("Listening for incoming challenges...");

  // 2. Listen for ChallengeOpened (Incoming Challenges)
  contract.on("ChallengeOpened", async (matchId: any, challenger: string, opponent: string, stakeUsdc: bigint, deadlineBlock: number, event: any) => {
    if (opponent.toLowerCase() !== myAddress.toLowerCase()) {
      return; // Challenge is not for this agent
    }

    const matchIdStr = matchId.toString();
    console.log(`\n[Challenge Received] Match ID: ${matchIdStr} from challenger ${challenger}`);
    console.log(`Stake: ${ethers.formatUnits(stakeUsdc, 6)} USDC`);

    // Strategy: Choose a random move (0 = Rock, 1 = Paper, 2 = Scissors)
    const move = Math.floor(Math.random() * 3);
    const salt = ethers.hexlify(ethers.randomBytes(32));
    const commit = ethers.solidityPackedKeccak256(["uint8", "bytes32"], [move, salt]);

    // Store move details to reveal later
    myMoves.set(matchIdStr, { move, salt });
    console.log(`Selected move: ${MOVE_NAMES[move]} (secret salt and commit generated)`);

    try {
      console.log(`Accepting challenge...`);
      const tx = await contract.acceptChallenge(matchId, commit);
      console.log(`Accept transaction sent: ${tx.hash}`);
      await tx.wait();
      console.log(`Challenge ${matchIdStr} accepted on-chain!`);
    } catch (err: any) {
      console.error(`Failed to accept challenge:`, err.reason || err.message || err);
    }
  });

  // 3. Listen for ChallengeAccepted (Time to reveal)
  contract.on("ChallengeAccepted", async (matchId: any, deadlineBlock: number, event: any) => {
    const matchIdStr = matchId.toString();
    const stored = myMoves.get(matchIdStr);
    
    if (!stored) {
      return; // Not our match, or did not initiate accept from here
    }

    console.log(`\n[Challenge Active] Match ID: ${matchIdStr} has been accepted.`);
    console.log(`Submitting move reveal...`);

    try {
      const tx = await contract.reveal(matchId, stored.move, stored.salt);
      console.log(`Reveal transaction sent: ${tx.hash}`);
      await tx.wait();
      console.log(`Move revealed! Awaiting opponent's reveal to settle the match.`);
    } catch (err: any) {
      console.error(`Failed to reveal move:`, err.reason || err.message || err);
    }
  });

  // 4. Listen for PvpResolved (Match Completed)
  contract.on("PvpResolved", (matchId: any, winner: string, challengerMove: number, opponentMove: number, payout: bigint) => {
    const matchIdStr = matchId.toString();
    if (!myMoves.has(matchIdStr)) return; // Not our match

    console.log(`\n[PvP Match Resolved] Match ID: ${matchIdStr}`);
    if (winner.toLowerCase() === myAddress.toLowerCase()) {
      console.log(`🎉 I WON! Payout of ${ethers.formatUnits(payout, 6)} USDC has been transferred directly to my wallet.`);
    } else if (winner === "0x0000000000000000000000000000000000000000") {
      console.log(`🤝 The match ended in a DRAW. Stakes refunded.`);
    } else {
      console.log(`😢 I LOST. Winner: ${winner}`);
    }
    
    myMoves.delete(matchIdStr); // Cleanup memory
  });

  process.on("SIGINT", () => {
    console.log("\nShutting down agent...");
    process.exit(0);
  });
}

main().catch((err) => {
  console.error("Runner encountered a fatal error:", err);
  process.exit(1);
});
