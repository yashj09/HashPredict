// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./MarketFactory.sol";

/// @notice Minimal interface for SUPRA's pull oracle (verifyOracleProofV2)
interface ISupraOraclePull {
    struct PriceInfo {
        uint256[] pairs;
        uint256[] prices;
        uint256[] timestamp;
        uint256[] decimal;
        uint256[] round;
    }

    function verifyOracleProofV2(bytes calldata _bytesProof)
        external
        returns (PriceInfo memory);
}

/// @title SupraResolver - Resolves prediction markets using SUPRA Oracle price feeds
/// @notice Fetches verified price data from SUPRA and resolves markets based on configurable conditions
contract SupraResolver is Ownable {
    ISupraOraclePull public immutable supra;
    MarketFactory public immutable factory;

    struct OracleConfig {
        uint32 pairId;           // SUPRA pair index (e.g., 18 = BTC_USD)
        uint256 targetPrice;     // target price in raw oracle units (before dividing by 10^decimal)
        bool resolveYesIfAbove;  // true = YES if price >= target, false = YES if price < target
        bool configured;
    }

    mapping(address => OracleConfig) public marketConfigs;

    event MarketConfigured(
        address indexed market,
        uint32 pairId,
        uint256 targetPrice,
        bool resolveYesIfAbove
    );
    event MarketResolvedViaOracle(
        address indexed market,
        uint256 oraclePrice,
        uint256 targetPrice,
        bool resolvedYes
    );

    constructor(address _supra, address _factory) Ownable(msg.sender) {
        supra = ISupraOraclePull(_supra);
        factory = MarketFactory(_factory);
    }

    /// @notice Configure oracle resolution for a market
    /// @param market Address of the prediction market
    /// @param pairId SUPRA pair index (e.g., 18 for BTC_USD, 19 for ETH_USD)
    /// @param targetPrice Target price in raw oracle units (e.g., for $100,000 with 18 decimals: 100000 * 1e18)
    /// @param resolveYesIfAbove If true, resolves YES when price >= target; if false, resolves YES when price < target
    function configureMarket(
        address market,
        uint32 pairId,
        uint256 targetPrice,
        bool resolveYesIfAbove
    ) external onlyOwner {
        require(factory.isMarket(market), "SupraResolver: not a valid market");
        marketConfigs[market] = OracleConfig({
            pairId: pairId,
            targetPrice: targetPrice,
            resolveYesIfAbove: resolveYesIfAbove,
            configured: true
        });
        emit MarketConfigured(market, pairId, targetPrice, resolveYesIfAbove);
    }

    /// @notice Resolve a market using a SUPRA oracle price proof
    /// @param market Address of the prediction market to resolve
    /// @param proofBytes Raw proof bytes fetched from SUPRA's /get_proof API
    function resolveWithPrice(address market, bytes calldata proofBytes) external {
        OracleConfig memory config = marketConfigs[market];
        require(config.configured, "SupraResolver: market not configured");

        // Verify proof and get price data
        ISupraOraclePull.PriceInfo memory priceInfo = supra.verifyOracleProofV2(proofBytes);

        // Find our pair in the returned data
        uint256 oraclePrice;
        bool found = false;
        for (uint256 i = 0; i < priceInfo.pairs.length; i++) {
            if (priceInfo.pairs[i] == config.pairId) {
                oraclePrice = priceInfo.prices[i];

                // Staleness check: timestamp is in milliseconds, must be within 5 minutes
                require(
                    priceInfo.timestamp[i] / 1000 >= block.timestamp - 300,
                    "SupraResolver: stale price"
                );

                found = true;
                break;
            }
        }
        require(found, "SupraResolver: pair not in proof");

        // Evaluate condition
        bool outcomeIsYes;
        if (config.resolveYesIfAbove) {
            outcomeIsYes = oraclePrice >= config.targetPrice;
        } else {
            outcomeIsYes = oraclePrice < config.targetPrice;
        }

        // Resolve via factory (factory calls emergencyResolve on the market)
        factory.oracleResolveMarket(market, outcomeIsYes);

        emit MarketResolvedViaOracle(market, oraclePrice, config.targetPrice, outcomeIsYes);
    }

    /// @notice Read oracle configuration for a market
    function getConfig(address market) external view returns (OracleConfig memory) {
        return marketConfigs[market];
    }
}
