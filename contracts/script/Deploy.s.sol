// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/MarketFactory.sol";
import "../src/MockUSDT.sol";
import "@openzeppelin/contracts/metatx/ERC2771Forwarder.sol";

contract DeployScript is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerKey);

        // 1. Deploy MockUSDT (with EIP-2612 Permit support)
        MockUSDT usdt = new MockUSDT();
        console.log("MockUSDT deployed at:", address(usdt));

        // 2. Deploy ERC2771Forwarder for gasless meta-transactions
        ERC2771Forwarder forwarder = new ERC2771Forwarder("HashPredictForwarder");
        console.log("ERC2771Forwarder deployed at:", address(forwarder));

        // 3. Deploy MarketFactory
        MarketFactory factory = new MarketFactory();
        console.log("MarketFactory deployed at:", address(factory));

        // 4. Configure factory
        factory.setCollateralWhitelist(address(usdt), true);
        console.log("USDT whitelisted as collateral");

        factory.setMinimumLiquidity(10e6);
        console.log("Minimum liquidity set to 10 USDT");

        factory.setTrustedForwarder(address(forwarder));
        console.log("Trusted forwarder set on factory");

        vm.stopBroadcast();

        console.log("---");
        console.log("Deployment complete!");
        console.log("MockUSDT:", address(usdt));
        console.log("ERC2771Forwarder:", address(forwarder));
        console.log("MarketFactory:", address(factory));
    }
}
