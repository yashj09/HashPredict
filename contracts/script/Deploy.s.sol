// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/MarketFactory.sol";
import "../src/MockUSDT.sol";

contract DeployScript is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerKey);

        // 1. Deploy MockUSDT
        MockUSDT usdt = new MockUSDT();
        console.log("MockUSDT deployed at:", address(usdt));

        // 2. Deploy MarketFactory
        MarketFactory factory = new MarketFactory();
        console.log("MarketFactory deployed at:", address(factory));

        // 3. Whitelist USDT as collateral
        factory.setCollateralWhitelist(address(usdt), true);
        console.log("USDT whitelisted as collateral");

        // 4. Set minimum liquidity to 10 USDT (6 decimals)
        factory.setMinimumLiquidity(10e6);
        console.log("Minimum liquidity set to 10 USDT");

        vm.stopBroadcast();

        console.log("---");
        console.log("Deployment complete!");
        console.log("MockUSDT:", address(usdt));
        console.log("MarketFactory:", address(factory));
    }
}
