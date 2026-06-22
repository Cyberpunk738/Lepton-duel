// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {LeptonArena} from "../src/LeptonArena.sol";

/// @title Deploy Lepton Arena to Arc
/// @notice Usage:
///   forge script script/DeployLeptonArena.s.sol \
///     --rpc-url $ARC_TESTNET_RPC_URL \
///     --broadcast \
///     --verify \
///     -vvvv
///
/// Required env vars:
///   PRIVATE_KEY        — deployer private key
///   USDC_ADDRESS       — USDC ERC-20 address on Arc
///   OWNER_ADDRESS      — admin/operator address (defaults to deployer)
///   INITIAL_POT        — optional: USDC amount to seed the prize pool (0 to skip)
contract DeployLeptonArena is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address usdc = vm.envAddress("USDC_ADDRESS");
        address owner = vm.envOr("OWNER_ADDRESS", vm.addr(deployerKey));
        uint256 initialPot = vm.envOr("INITIAL_POT", uint256(0));

        console.log("=== Lepton Arena Deployment ===");
        console.log("USDC:", usdc);
        console.log("Owner:", owner);
        console.log("Initial pot:", initialPot);

        vm.startBroadcast(deployerKey);

        // 1. Deploy the arena
        LeptonArena arena = new LeptonArena(usdc, owner);
        console.log("LeptonArena deployed at:", address(arena));

        // 2. Optionally seed the prize pool
        if (initialPot > 0) {
            // Deployer must have approved the arena for USDC first
            arena.seedPot(initialPot);
            console.log("Prize pool seeded with:", initialPot);
        }

        vm.stopBroadcast();

        // 3. Log deployment summary
        console.log("");
        console.log("=== Deployment Complete ===");
        console.log("Arena:", address(arena));
        console.log("USDC:", usdc);
        console.log("Owner:", owner);
        console.log("");
        console.log("Next steps:");
        console.log("  1. Set config if defaults need tuning: arena.setConfig(...)");
        console.log("  2. Approve arena for USDC spending from agent wallets");
        console.log("  3. Point your frontend/runner to:", address(arena));
    }
}
