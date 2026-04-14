// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/SpeedMarketAMM.sol";
import "../src/MockUSDT.sol";

contract DeploySpeedMarketScript is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address usdt = vm.envAddress("USDT_ADDRESS");
        address forwarder = vm.envAddress("FORWARDER_ADDRESS");

        vm.startBroadcast(deployerKey);

        // 1. Deploy SpeedMarketAMM
        SpeedMarketAMM speedMarket = new SpeedMarketAMM(usdt, forwarder);
        console.log("SpeedMarketAMM deployed at:", address(speedMarket));

        // 2. Mint USDT to deployer for keeper liquidity
        MockUSDT(usdt).faucet(10_000e6); // 10,000 USDT
        console.log("Minted 10,000 USDT to deployer");

        // 3. Approve SpeedMarketAMM to spend USDT
        MockUSDT(usdt).approve(address(speedMarket), type(uint256).max);
        console.log("Approved SpeedMarketAMM for USDT");

        vm.stopBroadcast();

        console.log("---");
        console.log("SpeedMarketAMM:", address(speedMarket));
        console.log("Collateral (USDT):", usdt);
        console.log("Forwarder:", forwarder);
        console.log("Owner:", vm.addr(deployerKey));
    }
}
