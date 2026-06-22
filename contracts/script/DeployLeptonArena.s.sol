// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {LeptonArena} from "../src/LeptonArena.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title Deploy Lepton Arena to Arc Testnet
/// @notice Usage:
///   forge script script/DeployLeptonArena.s.sol \
///     --rpc-url $ARC_TESTNET_RPC_URL \
///     --broadcast \
///     -vvvv
///
/// Required env vars:
///   PRIVATE_KEY        — deployer private key
///   USDC_ADDRESS       — USDC ERC-20 address
///
/// Optional env vars:
///   OWNER_ADDRESS      — admin/operator address (defaults to deployer)
///   INITIAL_POT        — USDC amount to seed the prize pool (default 0)
contract DeployLeptonArena is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);
        address owner = vm.envOr("OWNER_ADDRESS", deployer);
        uint256 initialPot = vm.envOr("INITIAL_POT", uint256(0));

        // Check if USDC_ADDRESS is provided
        address usdc = vm.envAddress("USDC_ADDRESS");
        require(usdc != address(0), "USDC_ADDRESS must be set");

        console.log("=== Lepton Arena Deployment ===");
        console.log("Deployer:", deployer);
        console.log("Owner:", owner);
        console.log("USDC Address:", usdc);

        vm.startBroadcast(deployerKey);

        // 1. Deploy the arena
        LeptonArena arena = new LeptonArena(usdc, owner);
        console.log("LeptonArena deployed at:", address(arena));

        // 2. Optionally seed the prize pool
        if (initialPot > 0) {
            IERC20(usdc).approve(address(arena), initialPot);
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
        console.log("  1. Approve arena for USDC: USDC.approve(arena, amount)");
        console.log("  2. Play: arena.play(0)  // Rock");
        console.log("  3. Update frontend CONTRACT_ADDRESS to:", address(arena));
    }
}
