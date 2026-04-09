// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/MarketFactory.sol";
import "../src/MockUSDT.sol";

contract SeedMarketsScript is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address factoryAddr = vm.envAddress("FACTORY_ADDRESS");
        address usdtAddr = vm.envAddress("USDT_ADDRESS");

        MarketFactory factory = MarketFactory(factoryAddr);
        MockUSDT usdt = MockUSDT(usdtAddr);

        vm.startBroadcast(deployerKey);

        // Mint USDT for seeding
        usdt.faucet(10_000e6);

        uint256 liquidity = 500e6; // 500 USDT per market
        uint256 endTime = block.timestamp + 60 days;

        // Approve factory for all markets
        usdt.approve(address(factory), liquidity * 4);

        // Market 1: BTC price prediction
        address m1 = factory.createMarket(
            "Will BTC hit $100,000 by June 2026?",
            "Crypto",
            address(usdt),
            liquidity,
            endTime
        );
        console.log("Market 1 (BTC):", m1);

        // Market 2: Gold RWA prediction
        address m2 = factory.createMarket(
            "Will gold hit $3,000/oz by Q3 2026?",
            "Commodities",
            address(usdt),
            liquidity,
            endTime
        );
        console.log("Market 2 (Gold):", m2);

        // Market 3: HSK price prediction
        address m3 = factory.createMarket(
            "Will HSK hit $5 by end of 2026?",
            "Crypto",
            address(usdt),
            liquidity,
            endTime
        );
        console.log("Market 3 (HSK):", m3);

        // Market 4: ETH ETF inflows
        address m4 = factory.createMarket(
            "Will Ethereum ETF inflows exceed $10B by Q3 2026?",
            "Crypto",
            address(usdt),
            liquidity,
            endTime
        );
        console.log("Market 4 (ETH ETF):", m4);

        vm.stopBroadcast();

        console.log("---");
        console.log("4 markets seeded successfully!");
    }
}
