"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import { CONTRACT_ADDRESS, USDC_ADDRESS, RPC_URL } from "./content";

declare global {
  interface Window {
    ethereum?: any;
  }
}

// ABI for the LeptonArena smart contract
export const ARENA_ABI = [
  "function getPot() external view returns (uint256)",
  "function getLeaderboard(uint256 topN) external view returns (tuple(address player, int32 rating)[])",
  "function getPlayer(address who) external view returns (int32 rating, uint32 games, uint32 wins, uint32 losses, uint32 draws, uint32[3] memory moveCounts, bool initialized)",
  "function play(uint8 playerMove) external returns (tuple(uint8 playerMove, uint8 houseMove, uint8 outcome, int32 newRating))",
  "event MatchPlayed(uint256 indexed matchId, address indexed player, uint8 playerMove, uint8 houseMove, uint8 outcome, int32 newRating)"
];

// ABI for the ERC20 USDC token interface
export const USDC_ABI = [
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function balanceOf(address account) external view returns (uint256)"
];

const ARC_CHAIN_ID = 5042002;
const ARC_CHAIN_ID_HEX = "0x" + ARC_CHAIN_ID.toString(16);

// Public JsonRpcProvider for read-only actions (leaderboard & pot)
const getReadProvider = () => {
  return new ethers.JsonRpcProvider(RPC_URL);
};

export async function fetchOnChainPot(): Promise<number> {
  try {
    const provider = getReadProvider();
    const contract = new ethers.Contract(CONTRACT_ADDRESS, ARENA_ABI, provider);
    const potRaw = await contract.getPot();
    return parseFloat(ethers.formatUnits(potRaw, 6));
  } catch (error) {
    console.error("Failed to fetch on-chain pot:", error);
    return 0;
  }
}

export interface OnChainLeaderboardEntry {
  rank: number;
  address: string;
  rating: number;
  delta: string;
}

export async function fetchOnChainLeaderboard(topN = 5): Promise<OnChainLeaderboardEntry[]> {
  try {
    const provider = getReadProvider();
    const contract = new ethers.Contract(CONTRACT_ADDRESS, ARENA_ABI, provider);
    const rawLeaderboard = await contract.getLeaderboard(topN);

    return rawLeaderboard.map((entry: any, index: number) => {
      const playerAddress = entry.player;
      const shortAddress = playerAddress.slice(0, 6) + "…" + playerAddress.slice(-4);
      return {
        rank: index + 1,
        address: shortAddress,
        rating: Number(entry.rating),
        delta: "-"
      };
    });
  } catch (error) {
    console.error("Failed to fetch on-chain leaderboard:", error);
    return [];
  }
}

export interface PlayerStats {
  rating: number;
  games: number;
  wins: number;
  losses: number;
  draws: number;
  moveCounts: [number, number, number];
  initialized: boolean;
}

// Create the Web3 context
const Web3WalletContext = createContext<any>(null);

function useWeb3WalletInternal() {
  const [address, setAddress] = useState<string>("");
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [balance, setBalance] = useState<string>("0");
  const [usdcBalance, setUsdcBalance] = useState<string>("0");
  const [elo, setElo] = useState<number>(1500);
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  const checkNetworkAndSwitch = async (ethereum: any): Promise<boolean> => {
    try {
      const currentChainId = await ethereum.request({ method: "eth_chainId" });
      if (parseInt(currentChainId, 16) !== ARC_CHAIN_ID) {
        try {
          await ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: ARC_CHAIN_ID_HEX }],
          });
          return true;
        } catch (switchError: any) {
          if (switchError.code === 4902) {
            await ethereum.request({
              method: "wallet_addEthereumChain",
              params: [
                {
                  chainId: ARC_CHAIN_ID_HEX,
                  chainName: "Arc Testnet",
                  nativeCurrency: {
                    name: "USDC",
                    symbol: "USDC",
                    decimals: 18,
                  },
                  rpcUrls: [RPC_URL],
                  blockExplorerUrls: ["https://testnet.arcscan.app"],
                },
              ],
            });
            return true;
          }
          throw switchError;
        }
      }
      return true;
    } catch (err: any) {
      console.error("Network check failed:", err);
      setError("Please switch your wallet to Arc Testnet.");
      return false;
    }
  };

  const fetchUserData = useCallback(async (walletAddress: string) => {
    if (!window.ethereum) return;
    try {
      const provider = new ethers.BrowserProvider(window.ethereum as any);
      
      const balanceRaw = await provider.getBalance(walletAddress);
      setBalance(Number(ethers.formatUnits(balanceRaw, 18)).toFixed(4));

      const usdcContract = new ethers.Contract(USDC_ADDRESS, USDC_ABI, provider);
      const usdcBalRaw = await usdcContract.balanceOf(walletAddress);
      setUsdcBalance(Number(ethers.formatUnits(usdcBalRaw, 6)).toFixed(2));

      const arenaContract = new ethers.Contract(CONTRACT_ADDRESS, ARENA_ABI, provider);
      const playerRecord = await arenaContract.getPlayer(walletAddress);
      
      if (playerRecord.initialized) {
        setElo(Number(playerRecord.rating));
        setStats({
          rating: Number(playerRecord.rating),
          games: Number(playerRecord.games),
          wins: Number(playerRecord.wins),
          losses: Number(playerRecord.losses),
          draws: Number(playerRecord.draws),
          moveCounts: [
            Number(playerRecord.moveCounts[0]),
            Number(playerRecord.moveCounts[1]),
            Number(playerRecord.moveCounts[2])
          ],
          initialized: true
        });
      } else {
        setElo(1500);
        setStats({
          rating: 1500,
          games: 0,
          wins: 0,
          losses: 0,
          draws: 0,
          moveCounts: [0, 0, 0],
          initialized: false
        });
      }
    } catch (err: any) {
      console.error("Failed to load player data from chain:", err);
    }
  }, []);

  const connect = async () => {
    setError("");
    if (!window.ethereum) {
      setError("No Web3 wallet detected. Please install MetaMask.");
      return;
    }
    setLoading(true);
    try {
      const isCorrectNetwork = await checkNetworkAndSwitch(window.ethereum);
      if (!isCorrectNetwork) {
        setLoading(false);
        return;
      }

      const provider = new ethers.BrowserProvider(window.ethereum as any);
      const accounts = await provider.send("eth_requestAccounts", []);
      const userAddress = accounts[0];
      
      setAddress(userAddress);
      setIsConnected(true);
      await fetchUserData(userAddress);
    } catch (err: any) {
      console.error("Wallet connection failed:", err);
      setError(err.message || "Failed to connect wallet.");
    } finally {
      setLoading(false);
    }
  };

  const playOnChain = async (move: number): Promise<{
    success: boolean;
    houseMove?: number;
    outcome?: number;
    newRating?: number;
    txHash?: string;
    error?: string;
  }> => {
    setError("");
    if (!window.ethereum || !isConnected || !address) {
      return { success: false, error: "Wallet not connected" };
    }
    setLoading(true);
    try {
      const provider = new ethers.BrowserProvider(window.ethereum as any);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(CONTRACT_ADDRESS, ARENA_ABI, signer);

      const tx = await contract.play(move);
      const receipt = await tx.wait();

      const iface = new ethers.Interface(ARENA_ABI);
      let matchPlayedLog: any = null;

      for (const log of receipt.logs) {
        try {
          const parsed = iface.parseLog({ topics: [...log.topics], data: log.data });
          if (parsed && parsed.name === "MatchPlayed") {
            matchPlayedLog = parsed;
            break;
          }
        } catch (e) {
          // Log not matching LeptonArena events
        }
      }

      await fetchUserData(address);

      if (matchPlayedLog) {
        return {
          success: true,
          houseMove: Number(matchPlayedLog.args.houseMove),
          outcome: Number(matchPlayedLog.args.outcome),
          newRating: Number(matchPlayedLog.args.newRating),
          txHash: tx.hash
        };
      }

      return { success: true, txHash: tx.hash };
    } catch (err: any) {
      console.error("On-chain duel transaction failed:", err);
      const msg = err.reason || err.message || "Transaction failed";
      setError(msg);
      return { success: false, error: msg };
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (window.ethereum) {
      window.ethereum.on("accountsChanged", (accounts: string[]) => {
        if (accounts.length > 0) {
          setAddress(accounts[0]);
          setIsConnected(true);
          fetchUserData(accounts[0]);
        } else {
          setAddress("");
          setIsConnected(false);
          setStats(null);
        }
      });

      window.ethereum.on("chainChanged", () => {
        window.location.reload();
      });
    }
  }, [fetchUserData]);

  return {
    address,
    isConnected,
    balance,
    usdcBalance,
    elo,
    stats,
    loading,
    error,
    connect,
    playOnChain,
    refresh: () => address && fetchUserData(address)
  };
}

export function Web3WalletProvider({ children }: { children: React.ReactNode }) {
  const wallet = useWeb3WalletInternal();
  return React.createElement(Web3WalletContext.Provider, { value: wallet }, children);
}

export function useWeb3Wallet() {
  return useContext(Web3WalletContext);
}
