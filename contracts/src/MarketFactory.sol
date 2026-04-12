// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./PredictionMarket.sol";

/// @title MarketFactory - Deploys and manages prediction markets
/// @notice Permissionless market creation with whitelisted collateral tokens
contract MarketFactory is Ownable {
    using SafeERC20 for IERC20;

    // --- State ---
    address[] public markets;
    mapping(address => bool) public whitelistedCollaterals;
    mapping(address => bool) public isMarket;
    mapping(address => bool) public authorizedResolvers;
    address public trustedForwarder;

    uint256 public creationFeeBps = 100; // 1%
    uint256 public constant BPS = 10_000;
    uint256 public minimumLiquidity = 1e6; // 1 USDT or 0.000000000001 HSK — low default, admin can adjust

    // --- Events ---
    event MarketCreated(
        address indexed market,
        address indexed creator,
        string question,
        string category,
        address collateralToken,
        uint256 endTimestamp,
        uint256 initialLiquidity
    );
    event CollateralWhitelisted(address indexed token, bool status);
    event CreationFeeUpdated(uint256 newFeeBps);

    constructor() Ownable(msg.sender) {}

    /// @notice Create a new prediction market
    /// @param question The question the market will predict
    /// @param category Market category (e.g., "Crypto", "Commodities", "RWA")
    /// @param collateralToken_ Address of the ERC-20 collateral token
    /// @param initialLiquidity Amount of collateral to seed the pool
    /// @param endTimestamp When the market ends
    /// @return market Address of the newly deployed market
    function createMarket(
        string calldata question,
        string calldata category,
        address collateralToken_,
        uint256 initialLiquidity,
        uint256 endTimestamp
    ) external returns (address market) {
        require(whitelistedCollaterals[collateralToken_], "MarketFactory: collateral not whitelisted");
        require(initialLiquidity >= minimumLiquidity, "MarketFactory: below min liquidity");
        require(endTimestamp > block.timestamp, "MarketFactory: end must be future");

        // Take creation fee
        uint256 fee = (initialLiquidity * creationFeeBps) / BPS;
        uint256 liquidityAfterFee = initialLiquidity - fee;

        // Transfer total (liquidity + fee) from creator
        IERC20(collateralToken_).safeTransferFrom(msg.sender, address(this), initialLiquidity);

        // Transfer fee to owner (protocol treasury)
        if (fee > 0) {
            IERC20(collateralToken_).safeTransfer(owner(), fee);
        }

        // Deploy market (pass trustedForwarder for gasless meta-tx support)
        PredictionMarket newMarket = new PredictionMarket(
            collateralToken_,
            question,
            category,
            endTimestamp,
            address(this), // resolver = factory (factory.resolveMarket calls market)
            address(this),
            trustedForwarder
        );

        // Approve and initialize market with liquidity
        IERC20(collateralToken_).forceApprove(address(newMarket), liquidityAfterFee);
        newMarket.initialize(liquidityAfterFee, msg.sender);

        market = address(newMarket);
        markets.push(market);
        isMarket[market] = true;

        emit MarketCreated(market, msg.sender, question, category, collateralToken_, endTimestamp, liquidityAfterFee);
    }

    // ========================
    //        ADMIN
    // ========================

    /// @notice Whitelist or remove a collateral token
    function setCollateralWhitelist(address token, bool status) external onlyOwner {
        whitelistedCollaterals[token] = status;
        emit CollateralWhitelisted(token, status);
    }

    /// @notice Update the creation fee
    function setCreationFee(uint256 newFeeBps) external onlyOwner {
        require(newFeeBps <= 500, "MarketFactory: fee too high"); // max 5%
        creationFeeBps = newFeeBps;
        emit CreationFeeUpdated(newFeeBps);
    }

    /// @notice Update minimum liquidity
    function setMinimumLiquidity(uint256 newMin) external onlyOwner {
        minimumLiquidity = newMin;
    }

    /// @notice Set the trusted forwarder for ERC-2771 gasless meta-transactions
    function setTrustedForwarder(address forwarder) external onlyOwner {
        trustedForwarder = forwarder;
    }

    /// @notice Resolve a market (convenience function for owner)
    function resolveMarket(address market, bool outcomeIsYes) external onlyOwner {
        require(isMarket[market], "MarketFactory: not a market");
        PredictionMarket(market).emergencyResolve(outcomeIsYes);
    }

    // ========================
    //    ORACLE RESOLVER
    // ========================

    /// @notice Authorize or revoke an external resolver (e.g., SupraResolver)
    function setAuthorizedResolver(address resolver, bool status) external onlyOwner {
        authorizedResolvers[resolver] = status;
    }

    /// @notice Called by an authorized resolver to resolve a market via oracle
    function oracleResolveMarket(address market, bool outcomeIsYes) external {
        require(authorizedResolvers[msg.sender], "MarketFactory: not authorized resolver");
        require(isMarket[market], "MarketFactory: not a market");
        PredictionMarket(market).emergencyResolve(outcomeIsYes);
    }

    // ========================
    //        VIEWS
    // ========================

    /// @notice Get all market addresses
    function getAllMarkets() external view returns (address[] memory) {
        return markets;
    }

    /// @notice Get the number of markets
    function getMarketCount() external view returns (uint256) {
        return markets.length;
    }
}
