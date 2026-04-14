// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/metatx/ERC2771Context.sol";

/// @title SpeedMarketAMM - Monolithic speed market contract with CPMM
/// @notice Short-duration binary markets (UP/DOWN) for crypto assets.
///         All markets stored in a single contract. Internal balance tracking
///         (no per-market ERC20 deployment). Supports gasless trading via ERC-2771.
contract SpeedMarketAMM is Ownable, ReentrancyGuard, ERC2771Context {
    using SafeERC20 for IERC20;

    // --- Types ---

    struct SpeedMarket {
        string asset;            // "BTC", "ETH", "SOL"
        uint256 strikePrice;     // 8 decimal precision (Pyth format)
        uint64 expiry;           // Unix timestamp
        bool resolved;
        bool outcomeIsUp;        // true = price went UP above strike
        uint256 reserveUp;       // CPMM pool reserve for UP tokens
        uint256 reserveDown;     // CPMM pool reserve for DOWN tokens
        uint256 totalCollateral;
        uint256 totalLpShares;
    }

    // --- State ---

    IERC20 public immutable collateralToken;

    mapping(uint256 => SpeedMarket) public markets;
    uint256 public nextMarketId;

    mapping(uint256 => mapping(address => uint256)) public lpBalances;
    mapping(uint256 => mapping(address => uint256)) public upBalances;
    mapping(uint256 => mapping(address => uint256)) public downBalances;
    mapping(uint256 => mapping(address => bool)) public claimed;

    uint256 public constant FEE_BPS = 200; // 2%
    uint256 public constant BPS = 10_000;

    // --- Events ---

    event MarketCreated(
        uint256 indexed marketId,
        string asset,
        uint256 strikePrice,
        uint64 expiry,
        uint256 initialLiquidity
    );
    event MarketResolved(uint256 indexed marketId, bool outcomeIsUp);
    event Buy(
        uint256 indexed marketId,
        address indexed user,
        bool indexed isUp,
        uint256 collateralIn,
        uint256 tokensOut
    );
    event Sell(
        uint256 indexed marketId,
        address indexed user,
        bool indexed isUp,
        uint256 tokensIn,
        uint256 collateralOut
    );
    event Claimed(uint256 indexed marketId, address indexed user, uint256 amount);
    event LiquidityAdded(uint256 indexed marketId, address indexed provider, uint256 amount, uint256 shares);
    event LiquidityRemoved(uint256 indexed marketId, address indexed provider, uint256 shares, uint256 collateralOut);

    // --- Constructor ---

    constructor(
        address collateralToken_,
        address trustedForwarder_
    ) Ownable(msg.sender) ERC2771Context(trustedForwarder_) {
        collateralToken = IERC20(collateralToken_);
    }

    // --- ERC2771 overrides ---

    function _msgSender() internal view override(Context, ERC2771Context) returns (address) {
        return ERC2771Context._msgSender();
    }

    function _msgData() internal view override(Context, ERC2771Context) returns (bytes calldata) {
        return ERC2771Context._msgData();
    }

    function _contextSuffixLength() internal view override(Context, ERC2771Context) returns (uint256) {
        return ERC2771Context._contextSuffixLength();
    }

    // ========================
    //    KEEPER / OWNER
    // ========================

    /// @notice Create a new speed market. Only callable by the keeper (owner).
    /// @param asset Asset symbol (e.g., "BTC")
    /// @param strikePrice Current price at creation in 8-decimal Pyth format
    /// @param expiry Unix timestamp when market ends
    /// @param initialLiquidity Collateral to seed the 50/50 CPMM pool
    /// @return marketId The ID of the newly created market
    function createMarket(
        string calldata asset,
        uint256 strikePrice,
        uint64 expiry,
        uint256 initialLiquidity
    ) external onlyOwner returns (uint256 marketId) {
        require(expiry > block.timestamp, "SpeedMarketAMM: expiry must be future");
        require(initialLiquidity > 0, "SpeedMarketAMM: zero liquidity");
        require(strikePrice > 0, "SpeedMarketAMM: zero strike");

        collateralToken.safeTransferFrom(msg.sender, address(this), initialLiquidity);

        marketId = nextMarketId++;

        SpeedMarket storage m = markets[marketId];
        m.asset = asset;
        m.strikePrice = strikePrice;
        m.expiry = expiry;
        m.reserveUp = initialLiquidity;
        m.reserveDown = initialLiquidity;
        m.totalCollateral = initialLiquidity;
        m.totalLpShares = initialLiquidity;

        lpBalances[marketId][msg.sender] = initialLiquidity;

        emit MarketCreated(marketId, asset, strikePrice, expiry, initialLiquidity);
    }

    /// @notice Resolve a speed market. Only callable by the keeper (owner).
    /// @param marketId The market to resolve
    /// @param outcomeIsUp true if price went above strike, false if below
    function resolveMarket(uint256 marketId, bool outcomeIsUp) external onlyOwner {
        SpeedMarket storage m = markets[marketId];
        require(!m.resolved, "SpeedMarketAMM: already resolved");

        m.resolved = true;
        m.outcomeIsUp = outcomeIsUp;

        emit MarketResolved(marketId, outcomeIsUp);
    }

    // ========================
    //        TRADING
    // ========================

    /// @notice Buy UP or DOWN tokens by depositing collateral
    /// @param marketId The market to trade on
    /// @param isUp true to buy UP tokens, false to buy DOWN tokens
    /// @param amount Collateral amount to spend
    /// @return tokensOut Number of tokens received
    function buy(
        uint256 marketId,
        bool isUp,
        uint256 amount
    ) external nonReentrant returns (uint256 tokensOut) {
        SpeedMarket storage m = markets[marketId];
        require(!m.resolved, "SpeedMarketAMM: resolved");
        require(block.timestamp < m.expiry, "SpeedMarketAMM: expired");
        require(amount > 0, "SpeedMarketAMM: zero amount");

        address sender = _msgSender();
        collateralToken.safeTransferFrom(sender, address(this), amount);

        // Fee
        uint256 fee = (amount * FEE_BPS) / BPS;
        uint256 effectiveAmount = amount - fee;

        // Mint equal virtual tokens backed by collateral
        m.totalCollateral += effectiveAmount;

        // CPMM swap: add unwanted side to pool, take wanted side out
        if (isUp) {
            uint256 k = m.reserveUp * m.reserveDown;
            uint256 newDownReserve = m.reserveDown + effectiveAmount;
            uint256 newUpReserve = k / newDownReserve;
            uint256 upFromSwap = m.reserveUp - newUpReserve;

            m.reserveUp = newUpReserve;
            m.reserveDown = newDownReserve;

            tokensOut = effectiveAmount + upFromSwap;
            upBalances[marketId][sender] += tokensOut;
        } else {
            uint256 k = m.reserveUp * m.reserveDown;
            uint256 newUpReserve = m.reserveUp + effectiveAmount;
            uint256 newDownReserve = k / newUpReserve;
            uint256 downFromSwap = m.reserveDown - newDownReserve;

            m.reserveUp = newUpReserve;
            m.reserveDown = newDownReserve;

            tokensOut = effectiveAmount + downFromSwap;
            downBalances[marketId][sender] += tokensOut;
        }

        emit Buy(marketId, sender, isUp, amount, tokensOut);
    }

    /// @notice Sell UP or DOWN tokens back for collateral
    /// @param marketId The market to trade on
    /// @param isUp true to sell UP tokens, false to sell DOWN tokens
    /// @param tokenAmount Number of tokens to sell
    /// @return collateralOut Collateral received
    function sell(
        uint256 marketId,
        bool isUp,
        uint256 tokenAmount
    ) external nonReentrant returns (uint256 collateralOut) {
        SpeedMarket storage m = markets[marketId];
        require(!m.resolved, "SpeedMarketAMM: resolved");
        require(block.timestamp < m.expiry, "SpeedMarketAMM: expired");
        require(tokenAmount > 0, "SpeedMarketAMM: zero amount");

        address sender = _msgSender();

        if (isUp) {
            require(upBalances[marketId][sender] >= tokenAmount, "SpeedMarketAMM: insufficient UP balance");
            upBalances[marketId][sender] -= tokenAmount;

            // Add UP to pool, compute freed DOWN tokens
            uint256 k = m.reserveUp * m.reserveDown;
            uint256 newUpReserve = m.reserveUp + tokenAmount;
            uint256 newDownReserve = k / newUpReserve;
            uint256 downFreed = m.reserveDown - newDownReserve;

            // Burn matched pairs to release collateral
            m.reserveUp = newUpReserve - downFreed;
            m.reserveDown = newDownReserve;
            m.totalCollateral -= downFreed;

            uint256 fee = (downFreed * FEE_BPS) / BPS;
            collateralOut = downFreed - fee;
        } else {
            require(downBalances[marketId][sender] >= tokenAmount, "SpeedMarketAMM: insufficient DOWN balance");
            downBalances[marketId][sender] -= tokenAmount;

            uint256 k = m.reserveUp * m.reserveDown;
            uint256 newDownReserve = m.reserveDown + tokenAmount;
            uint256 newUpReserve = k / newDownReserve;
            uint256 upFreed = m.reserveUp - newUpReserve;

            m.reserveUp = newUpReserve;
            m.reserveDown = newDownReserve - upFreed;
            m.totalCollateral -= upFreed;

            uint256 fee = (upFreed * FEE_BPS) / BPS;
            collateralOut = upFreed - fee;
        }

        collateralToken.safeTransfer(sender, collateralOut);

        emit Sell(marketId, sender, isUp, tokenAmount, collateralOut);
    }

    // ========================
    //        CLAIMS
    // ========================

    /// @notice Claim winnings from a resolved market
    /// @param marketId The resolved market
    function claim(uint256 marketId) external nonReentrant {
        SpeedMarket storage m = markets[marketId];
        require(m.resolved, "SpeedMarketAMM: not resolved");

        address sender = _msgSender();
        require(!claimed[marketId][sender], "SpeedMarketAMM: already claimed");

        uint256 balance = m.outcomeIsUp
            ? upBalances[marketId][sender]
            : downBalances[marketId][sender];

        require(balance > 0, "SpeedMarketAMM: no winnings");

        claimed[marketId][sender] = true;

        // Zero out both balances
        upBalances[marketId][sender] = 0;
        downBalances[marketId][sender] = 0;

        collateralToken.safeTransfer(sender, balance);

        emit Claimed(marketId, sender, balance);
    }

    // ========================
    //       LIQUIDITY
    // ========================

    /// @notice Add liquidity proportionally to an active market
    /// @param marketId The market to add liquidity to
    /// @param amount Collateral amount to add
    function addLiquidity(uint256 marketId, uint256 amount) external nonReentrant {
        SpeedMarket storage m = markets[marketId];
        require(!m.resolved, "SpeedMarketAMM: resolved");
        require(block.timestamp < m.expiry, "SpeedMarketAMM: expired");
        require(amount > 0, "SpeedMarketAMM: zero amount");
        require(m.totalLpShares > 0, "SpeedMarketAMM: not initialized");

        address sender = _msgSender();
        collateralToken.safeTransferFrom(sender, address(this), amount);

        uint256 shares = (amount * m.totalLpShares) / m.totalCollateral;
        uint256 upToAdd = (amount * m.reserveUp) / m.totalCollateral;
        uint256 downToAdd = (amount * m.reserveDown) / m.totalCollateral;

        m.reserveUp += upToAdd;
        m.reserveDown += downToAdd;
        m.totalCollateral += amount;
        m.totalLpShares += shares;
        lpBalances[marketId][sender] += shares;

        emit LiquidityAdded(marketId, sender, amount, shares);
    }

    /// @notice Remove liquidity from a market (works both pre- and post-resolution)
    /// @param marketId The market to remove liquidity from
    /// @param shares Number of LP shares to burn
    /// @return collateralOut Collateral received
    function removeLiquidity(
        uint256 marketId,
        uint256 shares
    ) external nonReentrant returns (uint256 collateralOut) {
        SpeedMarket storage m = markets[marketId];
        address sender = _msgSender();
        require(shares > 0 && shares <= lpBalances[marketId][sender], "SpeedMarketAMM: invalid shares");

        uint256 upAmount = (shares * m.reserveUp) / m.totalLpShares;
        uint256 downAmount = (shares * m.reserveDown) / m.totalLpShares;

        // Burn matched pairs for collateral
        uint256 matched = upAmount < downAmount ? upAmount : downAmount;

        m.reserveUp -= upAmount;
        m.reserveDown -= downAmount;
        m.totalCollateral -= matched;
        m.totalLpShares -= shares;
        lpBalances[marketId][sender] -= shares;

        collateralOut = matched;
        if (collateralOut > 0) {
            collateralToken.safeTransfer(sender, collateralOut);
        }

        emit LiquidityRemoved(marketId, sender, shares, collateralOut);
    }

    // ========================
    //        VIEWS
    // ========================

    /// @notice Get full market data
    function getMarket(uint256 marketId) external view returns (
        string memory asset,
        uint256 strikePrice,
        uint64 expiry,
        bool resolved,
        bool outcomeIsUp,
        uint256 reserveUp,
        uint256 reserveDown,
        uint256 totalCollateral,
        uint256 totalLpShares
    ) {
        SpeedMarket storage m = markets[marketId];
        return (
            m.asset,
            m.strikePrice,
            m.expiry,
            m.resolved,
            m.outcomeIsUp,
            m.reserveUp,
            m.reserveDown,
            m.totalCollateral,
            m.totalLpShares
        );
    }

    /// @notice Get UP and DOWN prices scaled to 1e18
    function getPrices(uint256 marketId) external view returns (uint256 upPrice, uint256 downPrice) {
        SpeedMarket storage m = markets[marketId];
        uint256 total = m.reserveUp + m.reserveDown;
        if (total == 0) return (5e17, 5e17);
        upPrice = (m.reserveDown * 1e18) / total;
        downPrice = (m.reserveUp * 1e18) / total;
    }

    /// @notice Quote how many tokens a buy would return
    function getAmountOut(
        uint256 marketId,
        bool isUp,
        uint256 amount
    ) external view returns (uint256 tokensOut) {
        SpeedMarket storage m = markets[marketId];
        uint256 fee = (amount * FEE_BPS) / BPS;
        uint256 effectiveAmount = amount - fee;

        if (isUp) {
            uint256 k = m.reserveUp * m.reserveDown;
            uint256 newDownReserve = m.reserveDown + effectiveAmount;
            uint256 newUpReserve = k / newDownReserve;
            tokensOut = effectiveAmount + (m.reserveUp - newUpReserve);
        } else {
            uint256 k = m.reserveUp * m.reserveDown;
            uint256 newUpReserve = m.reserveUp + effectiveAmount;
            uint256 newDownReserve = k / newUpReserve;
            tokensOut = effectiveAmount + (m.reserveDown - newDownReserve);
        }
    }

    /// @notice Get a user's UP and DOWN token balances for a market
    function getUserBalances(
        uint256 marketId,
        address user
    ) external view returns (uint256 up, uint256 down) {
        up = upBalances[marketId][user];
        down = downBalances[marketId][user];
    }
}
