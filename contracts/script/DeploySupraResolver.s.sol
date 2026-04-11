// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/SupraResolver.sol";
import "../src/MarketFactory.sol";

contract DeploySupraResolverScript is Script {
    // SUPRA Pull Oracle on HashKey Chain Testnet
    address constant SUPRA_TESTNET = 0x443A0f4Da5d2fdC47de3eeD45Af41d399F0E5702;

    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address factoryAddress = vm.envAddress("FACTORY_ADDRESS");

        vm.startBroadcast(deployerKey);

        // 1. Deploy SupraResolver
        SupraResolver resolver = new SupraResolver(SUPRA_TESTNET, factoryAddress);
        console.log("SupraResolver deployed at:", address(resolver));

        // 2. Authorize the resolver in the factory
        MarketFactory factory = MarketFactory(factoryAddress);
        factory.setAuthorizedResolver(address(resolver), true);
        console.log("SupraResolver authorized in factory");

        vm.stopBroadcast();

        console.log("---");
        console.log("SupraResolver:", address(resolver));
        console.log("Factory:", factoryAddress);
        console.log("SUPRA Oracle:", SUPRA_TESTNET);
    }
}
