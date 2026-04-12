// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/metatx/ERC2771Context.sol";
import "./OutcomeToken.sol";

/// @title PredictionMarket - A CPMM-based binary prediction market
/// @notice Users buy/sell YES or NO outcome tokens. After resolution, winners redeem 1:1 for collateral.
///         Supports gasless meta-transactions via ERC-2771 trusted forwarder.
contract PredictionMarket is ReentrancyGuard, ERC2771Context {
    using SafeERC20 for IERC20;
    using SafeERC20 for OutcomeToken;
    using Math for uint256;

    // --- State ---
    IERC20 public immutable collateralToken;
    OutcomeToken public immutable yesToken;
    OutcomeToken public immutable noToken;
    address public immutable factory;
    address public resolver;

    string public question;
    string public category;
    uint256 public endTimestamp;
    uint256 public createdAt;

    bool public resolved;
    bool public outcomeYes; // true = YES won, false = NO won

    uint256 public yesReserve;
    uint256 public noReserve;
    uint256 public totalCollateral;

    uint256 public constant FEE_BPS = 200; // 2%
    uint256 public constant BPS = 10_000;

    // LP tracking
    uint256 public totalLpShares;
    mapping(address => uint256) public lpShares;

    // Volume tracking
    uint256 public totalVolume;

    // Claim tracking
    mapping(address => bool) public claimed;

    // --- Events ---
    event Buy(address indexed user, bool indexed isYes, uint256 collateralIn, uint256 tokensOut);
    event Sell(address indexed user, bool indexed isYes, uint256 tokensIn, uint256 collateralOut);
    event LiquidityAdded(address indexed provider, uint256 collateralAmount, uint256 lpSharesMinted);
    event LiquidityRemoved(address indexed provider, uint256 lpSharesBurned, uint256 collateralOut);
    event MarketResolved(bool outcomeIsYes);
    event WinningsClaimed(address indexed user, uint256 amount);

    // --- Modifiers ---
    modifier onlyResolver() {
        require(msg.sender == resolver, "PredictionMarket: not resolver");
        _;
    }

    modifier marketActive() {
        require(!resolved, "PredictionMarket: market resolved");
        require(block.timestamp < endTimestamp, "PredictionMarket: market expired");
        _;
    }

    modifier marketResolved() {
        require(resolved, "PredictionMarket: not resolved yet");
        _;
    }

    constructor(
        address collateralToken_,
        string memory question_,
        string memory category_,
        uint256 endTimestamp_,
        address resolver_,
        address factory_,
        address trustedForwarder_
    ) ERC2771Context(trustedForwarder_) {
        require(endTimestamp_ > block.timestamp, "PredictionMarket: end must be future");

        collateralToken = IERC20(collateralToken_);
        question = question_;
        category = category_;
        endTimestamp = endTimestamp_;
        resolver = resolver_;
        factory = factory_;
        createdAt = block.timestamp;

        // Deploy outcome tokens
        yesToken = new OutcomeToken(
            string.concat(question_, " - YES"),
            "YES",
            address(this)
        );
        noToken = new OutcomeToken(
            string.concat(question_, " - NO"),
            "NO",
            address(this)
        );
    }

    /// @notice Initialize the market with liquidity. Called once by factory after creation.
    /// @dev Factory transfers collateral to this contract via safeTransferFrom (factory has the tokens).
    /// @param initialLiquidity Amount of collateral to seed the 50/50 pool
    /// @param provider The address to credit LP shares to
    function initialize(uint256 initialLiquidity, address provider) external {
        require(msg.sender == factory, "PredictionMarket: only factory");
        require(totalLpShares == 0, "PredictionMarket: already initialized");
        require(initialLiquidity > 0, "PredictionMarket: zero liquidity");

        // Factory already approved this contract, transfer from factory
        collateralToken.safeTransferFrom(msg.sender, address(this), initialLiquidity);

        // Mint equal YES and NO tokens into the pool reserves
        yesToken.mint(address(this), initialLiquidity);
        noToken.mint(address(this), initialLiquidity);

        yesReserve = initialLiquidity;
        noReserve = initialLiquidity;
        totalCollateral = initialLiquidity;

        // LP shares for initial provider
        totalLpShares = initialLiquidity;
        lpShares[provider] = initialLiquidity;

        emit LiquidityAdded(provider, initialLiquidity, initialLiquidity);
    }

    // ========================
    //        TRADING
    // ========================

    /// @notice Buy outcome tokens (YES or NO) by depositing collateral
    /// @param isYes true to buy YES tokens, false to buy NO tokens
    /// @param collateralAmount Amount of collateral to spend
    /// @return tokensOut Amount of outcome tokens received
    function buy(bool isYes, uint256 collateralAmount) external nonReentrant marketActive returns (uint256 tokensOut) {
        require(collateralAmount > 0, "PredictionMarket: zero amount");

        // Transfer collateral from user (_msgSender() supports meta-tx via ERC-2771)
        address sender = _msgSender();
        collateralToken.safeTransferFrom(sender, address(this), collateralAmount);

        // Take fee
        uint256 fee = (collateralAmount * FEE_BPS) / BPS;
        uint256 effectiveAmount = collateralAmount - fee;

        // Mint equal YES + NO tokens backed by collateral
        yesToken.mint(address(this), effectiveAmount);
        noToken.mint(address(this), effectiveAmount);
        totalCollateral += effectiveAmount;

        // CPMM swap: trade the unwanted side for more of the wanted side
        if (isYes) {
            // Add NO to pool, take YES out
            uint256 k = yesReserve * noReserve;
            uint256 newNoReserve = noReserve + effectiveAmount;
            uint256 newYesReserve = k / newNoReserve;
            uint256 yesFromSwap = yesReserve - newYesReserve;

            yesReserve = newYesReserve;
            noReserve = newNoReserve;

            // User gets: minted YES + swapped YES
            tokensOut = effectiveAmount + yesFromSwap;
            yesToken.safeTransfer(sender, tokensOut);
        } else {
            // Add YES to pool, take NO out
            uint256 k = yesReserve * noReserve;
            uint256 newYesReserve = yesReserve + effectiveAmount;
            uint256 newNoReserve = k / newYesReserve;
            uint256 noFromSwap = noReserve - newNoReserve;

            yesReserve = newYesReserve;
            noReserve = newNoReserve;

            tokensOut = effectiveAmount + noFromSwap;
            noToken.safeTransfer(sender, tokensOut);
        }

        totalVolume += collateralAmount;
        emit Buy(sender, isYes, collateralAmount, tokensOut);
    }

    /// @notice Sell outcome tokens back for collateral
    /// @param isYes true to sell YES tokens, false to sell NO tokens
    /// @param tokenAmount Amount of outcome tokens to sell
    /// @return collateralOut Amount of collateral received
    function sell(bool isYes, uint256 tokenAmount) external nonReentrant marketActive returns (uint256 collateralOut) {
        require(tokenAmount > 0, "PredictionMarket: zero amount");
        address sender = _msgSender();

        if (isYes) {
            // Transfer YES tokens from user and add to pool
            yesToken.safeTransferFrom(sender, address(this), tokenAmount);
            uint256 k = yesReserve * noReserve;
            uint256 newYesReserve = yesReserve + tokenAmount;
            uint256 newNoReserve = k / newYesReserve;
            uint256 noFreed = noReserve - newNoReserve;

            // Burn matched pairs (noFreed YES + noFreed NO) to release collateral
            yesToken.burn(address(this), noFreed);
            noToken.burn(address(this), noFreed);

            yesReserve = newYesReserve - noFreed;
            noReserve = newNoReserve;
            totalCollateral -= noFreed;

            // Take fee
            uint256 fee = (noFreed * FEE_BPS) / BPS;
            collateralOut = noFreed - fee;
        } else {
            // Transfer NO tokens from user and add to pool
            noToken.safeTransferFrom(sender, address(this), tokenAmount);
            uint256 k = yesReserve * noReserve;
            uint256 newNoReserve = noReserve + tokenAmount;
            uint256 newYesReserve = k / newNoReserve;
            uint256 yesFreed = yesReserve - newYesReserve;

            yesToken.burn(address(this), yesFreed);
            noToken.burn(address(this), yesFreed);

            yesReserve = newYesReserve;
            noReserve = newNoReserve - yesFreed;
            totalCollateral -= yesFreed;

            uint256 fee = (yesFreed * FEE_BPS) / BPS;
            collateralOut = yesFreed - fee;
        }

        collateralToken.safeTransfer(sender, collateralOut);
        totalVolume += collateralOut;

        emit Sell(sender, isYes, tokenAmount, collateralOut);
    }

    // ========================
    //       LIQUIDITY
    // ========================

    /// @notice Add liquidity to the pool proportionally
    /// @param collateralAmount Amount of collateral to add
    function addLiquidity(uint256 collateralAmount) external nonReentrant marketActive {
        require(collateralAmount > 0, "PredictionMarket: zero amount");
        require(totalLpShares > 0, "PredictionMarket: not initialized");
        address sender = _msgSender();

        collateralToken.safeTransferFrom(sender, address(this), collateralAmount);

        // Calculate LP shares proportionally
        uint256 shares = (collateralAmount * totalLpShares) / totalCollateral;

        // Mint proportional YES and NO tokens to reserves
        uint256 yesToMint = (collateralAmount * yesReserve) / totalCollateral;
        uint256 noToMint = (collateralAmount * noReserve) / totalCollateral;

        yesToken.mint(address(this), yesToMint);
        noToken.mint(address(this), noToMint);

        yesReserve += yesToMint;
        noReserve += noToMint;
        totalCollateral += collateralAmount;

        lpShares[sender] += shares;
        totalLpShares += shares;

        emit LiquidityAdded(sender, collateralAmount, shares);
    }

    /// @notice Remove liquidity from the pool
    /// @param shares Amount of LP shares to burn
    function removeLiquidity(uint256 shares) external nonReentrant marketActive {
        address sender = _msgSender();
        require(shares > 0 && shares <= lpShares[sender], "PredictionMarket: invalid shares");

        uint256 yesAmount = (shares * yesReserve) / totalLpShares;
        uint256 noAmount = (shares * noReserve) / totalLpShares;

        // Burn matched pairs for collateral
        uint256 matched = yesAmount < noAmount ? yesAmount : noAmount;

        yesToken.burn(address(this), yesAmount);
        noToken.burn(address(this), noAmount);

        yesReserve -= yesAmount;
        noReserve -= noAmount;
        totalCollateral -= matched;

        lpShares[sender] -= shares;
        totalLpShares -= shares;

        // Return collateral for matched pairs
        collateralToken.safeTransfer(sender, matched);

        // Transfer any unmatched outcome tokens directly to the LP
        if (yesAmount > noAmount) {
            yesToken.mint(sender, yesAmount - matched);
        } else if (noAmount > yesAmount) {
            noToken.mint(sender, noAmount - matched);
        }

        emit LiquidityRemoved(sender, shares, matched);
    }

    // ========================
    //      RESOLUTION
    // ========================

    /// @notice Resolve the market with the winning outcome
    /// @param outcomeIsYes true if YES wins, false if NO wins
    function resolve(bool outcomeIsYes) external onlyResolver {
        require(!resolved, "PredictionMarket: already resolved");
        require(block.timestamp >= endTimestamp, "PredictionMarket: market not ended");

        resolved = true;
        outcomeYes = outcomeIsYes;

        emit MarketResolved(outcomeIsYes);
    }

    /// @notice Emergency resolve — allows resolver to resolve before end time
    function emergencyResolve(bool outcomeIsYes) external onlyResolver {
        require(!resolved, "PredictionMarket: already resolved");

        resolved = true;
        outcomeYes = outcomeIsYes;

        emit MarketResolved(outcomeIsYes);
    }

    /// @notice Claim winnings after market resolution
    function claim() external nonReentrant marketResolved {
        address sender = _msgSender();
        require(!claimed[sender], "PredictionMarket: already claimed");

        OutcomeToken winningToken = outcomeYes ? yesToken : noToken;
        uint256 balance = winningToken.balanceOf(sender);
        require(balance > 0, "PredictionMarket: no winnings");

        claimed[sender] = true;
        winningToken.burn(sender, balance);
        collateralToken.safeTransfer(sender, balance);

        emit WinningsClaimed(sender, balance);
    }

    // ========================
    //        VIEWS
    // ========================

    /// @notice Get current YES and NO prices (scaled to 1e18)
    function getPrices() external view returns (uint256 yesPrice, uint256 noPrice) {
        uint256 total = yesReserve + noReserve;
        if (total == 0) return (5e17, 5e17); // 50/50 default
        yesPrice = (noReserve * 1e18) / total;
        noPrice = (yesReserve * 1e18) / total;
    }

    /// @notice Estimate tokens out for a given collateral input
    /// @param isYes true to quote YES, false to quote NO
    /// @param collateralAmount Amount of collateral to spend
    function getAmountOut(bool isYes, uint256 collateralAmount) external view returns (uint256 tokensOut) {
        uint256 fee = (collateralAmount * FEE_BPS) / BPS;
        uint256 effectiveAmount = collateralAmount - fee;

        if (isYes) {
            uint256 k = yesReserve * noReserve;
            uint256 newNoReserve = noReserve + effectiveAmount;
            uint256 newYesReserve = k / newNoReserve;
            tokensOut = effectiveAmount + (yesReserve - newYesReserve);
        } else {
            uint256 k = yesReserve * noReserve;
            uint256 newYesReserve = yesReserve + effectiveAmount;
            uint256 newNoReserve = k / newYesReserve;
            tokensOut = effectiveAmount + (noReserve - newNoReserve);
        }
    }

    /// @notice Get collateral out for selling outcome tokens
    function getSellQuote(bool isYes, uint256 tokenAmount) external view returns (uint256 collateralOut) {
        if (isYes) {
            uint256 k = yesReserve * noReserve;
            uint256 newYesReserve = yesReserve + tokenAmount;
            uint256 newNoReserve = k / newYesReserve;
            uint256 noFreed = noReserve - newNoReserve;
            uint256 fee = (noFreed * FEE_BPS) / BPS;
            collateralOut = noFreed - fee;
        } else {
            uint256 k = yesReserve * noReserve;
            uint256 newNoReserve = noReserve + tokenAmount;
            uint256 newYesReserve = k / newNoReserve;
            uint256 yesFreed = yesReserve - newYesReserve;
            uint256 fee = (yesFreed * FEE_BPS) / BPS;
            collateralOut = yesFreed - fee;
        }
    }

    /// @notice Get full market info for frontend
    function getMarketInfo()
        external
        view
        returns (
            string memory _question,
            string memory _category,
            address _collateralToken,
            uint256 _endTimestamp,
            bool _resolved,
            bool _outcomeYes,
            uint256 _yesReserve,
            uint256 _noReserve,
            uint256 _totalCollateral,
            uint256 _totalVolume,
            address _yesToken,
            address _noToken
        )
    {
        return (
            question,
            category,
            address(collateralToken),
            endTimestamp,
            resolved,
            outcomeYes,
            yesReserve,
            noReserve,
            totalCollateral,
            totalVolume,
            address(yesToken),
            address(noToken)
        );
    }
}
