import { ethers } from "ethers";
import dotenv from "dotenv";
import { shortActor } from "./core/posts.js";

// Load environment variables
dotenv.config();

const RPC_URL = process.env.RPC_URL || "https://rpc.testnet.arc.network";
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || "0x72e832B7053D8178F710E6CB7F1EA5C337C048e0";

console.log("=== Lepton Arena EVM Runner Starting ===");
console.log("RPC Endpoint:", RPC_URL);
console.log("Contract Address:", CONTRACT_ADDRESS);

const ARENA_ABI = [
  "event MatchPlayed(uint256 indexed matchId, address indexed player, uint8 playerMove, uint8 houseMove, uint8 outcome, int32 newRating)",
  "event NewChampion(address indexed player, int32 rating)",
  "event PvpResolved(uint256 indexed matchId, address winner, uint8 challengerMove, uint8 opponentMove, uint256 payout)"
];

const MOVE_NAMES = ["Rock", "Paper", "Scissors"];
const MOVE_GLYPHS = ["🪨", "📄", "✂️"];
const OUTCOME_NAMES = ["Win", "Loss", "Draw"];
const OUTCOME_VERDICTS = ["beat the house", "fell to the house", "drew the house"];

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const contract = new ethers.Contract(CONTRACT_ADDRESS, ARENA_ABI, provider);

  console.log("Connected to Arc Testnet. Listening for events...");

  // 1. Listen for MatchPlayed (House Duels)
  contract.on("MatchPlayed", (matchId, player, playerMove, houseMove, outcome, newRating, event) => {
    const pMove = MOVE_NAMES[Number(playerMove)] || "Unknown";
    const hMove = MOVE_NAMES[Number(houseMove)] || "Unknown";
    const pGlyph = MOVE_GLYPHS[Number(playerMove)] || "";
    const hGlyph = MOVE_GLYPHS[Number(houseMove)] || "";
    const verdict = OUTCOME_VERDICTS[Number(outcome)] || "played";
    
    console.log(`\n[EVENT: MatchPlayed] Match ID: ${matchId}`);
    console.log(`⚔️ ${shortActor(player)} ${verdict} (${pGlyph} ${pMove} vs ${hGlyph} ${hMove}) — now rated ${newRating} in the Lepton Arena on Arc.`);
    console.log(`🔗 Transaction: https://testnet.arcscan.app/tx/${event.log.transactionHash}`);
  });

  // 2. Listen for NewChampion
  contract.on("NewChampion", (player, rating, event) => {
    console.log(`\n[EVENT: NewChampion] 👑`);
    console.log(`👑 New champion — ${shortActor(player)} tops the Lepton Arena leaderboard at ${rating}.`);
    console.log(`🔗 Transaction: https://testnet.arcscan.app/tx/${event.log.transactionHash}`);
  });

  // 3. Listen for PvpResolved (Agent duels)
  contract.on("PvpResolved", (matchId, winner, challengerMove, opponentMove, payout, event) => {
    const cMove = MOVE_NAMES[Number(challengerMove)] || "Unknown";
    const oMove = MOVE_NAMES[Number(opponentMove)] || "Unknown";
    const cGlyph = MOVE_GLYPHS[Number(challengerMove)] || "";
    const oGlyph = MOVE_GLYPHS[Number(opponentMove)] || "";
    
    const payoutUsdc = Number(ethers.formatUnits(payout, 6)).toFixed(2);
    
    console.log(`\n[EVENT: PvpResolved] Match ID: ${matchId}`);
    if (winner === "0x0000000000000000000000000000000000000000") {
      console.log(`🤝 Staked PvP duel ended in a DRAW (${cGlyph} ${cMove} vs ${oGlyph} ${oMove}) — stakes returned.`);
    } else {
      console.log(`⚔️ ${shortActor(winner)} won a staked PvP duel (${cGlyph} ${cMove} vs ${oGlyph} ${oMove}) taking a payout of ${payoutUsdc} USDC!`);
    }
    console.log(`🔗 Transaction: https://testnet.arcscan.app/tx/${event.log.transactionHash}`);
  });

  // Keep process alive
  process.on("SIGINT", () => {
    console.log("\nShutting down EVM runner...");
    process.exit(0);
  });
}

main().catch((err) => {
  console.error("Runner encountered a fatal error:", err);
  process.exit(1);
});
