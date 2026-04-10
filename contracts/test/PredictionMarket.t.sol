// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/MarketFactory.sol";
import "../src/PredictionMarket.sol";
import "../src/MockUSDT.sol";

contract PredictionMarketTest is Test {
    MarketFactory public factory;
    MockUSDT public usdt;

    address public owner = address(this);
    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");

    uint256 public constant INITIAL_LIQUIDITY = 1000e6; // 1000 USDT
    uint256 public constant END_TIME = 1_800_000_000; // far future

    function setUp() public {
        factory = new MarketFactory();
        usdt = new MockUSDT();

        // Whitelist USDT
        factory.setCollateralWhitelist(address(usdt), true);

        // Fund accounts
        usdt.faucet(10_000e6);
        deal(address(usdt), alice, 10_000e6);
        deal(address(usdt), bob, 10_000e6);
    }

    function _createMarket() internal returns (PredictionMarket market) {
        usdt.approve(address(factory), INITIAL_LIQUIDITY);
        address marketAddr = factory.createMarket(
            "Will BTC hit $100K?",
            "Crypto",
            address(usdt),
            INITIAL_LIQUIDITY,
            END_TIME
        );
        market = PredictionMarket(marketAddr);
    }

    // ========================
    //    MARKET CREATION
    // ========================

    function test_CreateMarket() public {
        PredictionMarket market = _createMarket();

        assertEq(market.question(), "Will BTC hit $100K?");
        assertEq(market.category(), "Crypto");
        assertEq(address(market.collateralToken()), address(usdt));
        assertEq(market.endTimestamp(), END_TIME);
        assertFalse(market.resolved());

        // 1% creation fee, so pool gets 990 USDT
        uint256 expectedLiquidity = INITIAL_LIQUIDITY - (INITIAL_LIQUIDITY * 100 / 10_000);
        assertEq(market.yesReserve(), expectedLiquidity);
        assertEq(market.noReserve(), expectedLiquidity);
        assertEq(market.totalCollateral(), expectedLiquidity);
    }

    function test_CreateMarket_MultipleMarkets() public {
        _createMarket();

        usdt.approve(address(factory), INITIAL_LIQUIDITY);
        factory.createMarket("Will gold hit $3000?", "RWA", address(usdt), INITIAL_LIQUIDITY, END_TIME);

        assertEq(factory.getMarketCount(), 2);
    }

    function test_CreateMarket_RevertIfNotWhitelisted() public {
        MockUSDT fakeToken = new MockUSDT();
        fakeToken.approve(address(factory), INITIAL_LIQUIDITY);
        vm.expectRevert("MarketFactory: collateral not whitelisted");
        factory.createMarket("Test", "Test", address(fakeToken), INITIAL_LIQUIDITY, END_TIME);
    }

    // ========================
    //        BUYING
    // ========================

    function test_BuyYes() public {
        PredictionMarket market = _createMarket();

        uint256 buyAmount = 100e6; // 100 USDT
        vm.startPrank(alice);
        usdt.approve(address(market), buyAmount);
        uint256 tokensOut = market.buy(true, buyAmount);
        vm.stopPrank();

        assertGt(tokensOut, 0);
        assertEq(market.yesToken().balanceOf(alice), tokensOut);

        // After buying YES, YES price should increase
        (uint256 yesPrice,) = market.getPrices();
        assertGt(yesPrice, 5e17); // > 50%
    }

    function test_BuyNo() public {
        PredictionMarket market = _createMarket();

        uint256 buyAmount = 100e6;
        vm.startPrank(bob);
        usdt.approve(address(market), buyAmount);
        uint256 tokensOut = market.buy(false, buyAmount);
        vm.stopPrank();

        assertGt(tokensOut, 0);
        assertEq(market.noToken().balanceOf(bob), tokensOut);

        // After buying NO, NO price should increase (YES price decreases)
        (uint256 yesPrice,) = market.getPrices();
        assertLt(yesPrice, 5e17); // < 50%
    }

    function test_BuyMovesPrices() public {
        PredictionMarket market = _createMarket();

        // Buy YES → YES price goes up
        vm.startPrank(alice);
        usdt.approve(address(market), 200e6);
        market.buy(true, 200e6);
        vm.stopPrank();

        (uint256 yesPrice1,) = market.getPrices();

        // Buy more YES → price goes up further
        vm.startPrank(bob);
        usdt.approve(address(market), 200e6);
        market.buy(true, 200e6);
        vm.stopPrank();

        (uint256 yesPrice2,) = market.getPrices();
        assertGt(yesPrice2, yesPrice1);
    }

    function test_PricesSumToOne() public {
        PredictionMarket market = _createMarket();

        vm.startPrank(alice);
        usdt.approve(address(market), 500e6);
        market.buy(true, 500e6);
        vm.stopPrank();

        (uint256 yesPrice, uint256 noPrice) = market.getPrices();
        // Prices should approximately sum to 1e18 (small rounding error acceptable)
        uint256 sum = yesPrice + noPrice;
        assertApproxEqAbs(sum, 1e18, 1e15); // within 0.1%
    }

    // ========================
    //        SELLING
    // ========================

    function test_SellYes() public {
        PredictionMarket market = _createMarket();

        // Buy first
        vm.startPrank(alice);
        usdt.approve(address(market), 100e6);
        uint256 tokensOut = market.buy(true, 100e6);

        uint256 balanceBefore = usdt.balanceOf(alice);

        // Sell back
        market.yesToken().approve(address(market), tokensOut);
        uint256 collateralOut = market.sell(true, tokensOut);
        vm.stopPrank();

        assertGt(collateralOut, 0);
        assertEq(usdt.balanceOf(alice), balanceBefore + collateralOut);
    }

    function test_SellNo() public {
        PredictionMarket market = _createMarket();

        vm.startPrank(bob);
        usdt.approve(address(market), 100e6);
        uint256 tokensOut = market.buy(false, 100e6);

        market.noToken().approve(address(market), tokensOut);
        uint256 collateralOut = market.sell(false, tokensOut);
        vm.stopPrank();

        assertGt(collateralOut, 0);
    }

    // ========================
    //      RESOLUTION
    // ========================

    function test_ResolveMarket() public {
        PredictionMarket market = _createMarket();

        // Warp past end time, resolve via factory (resolver = factory)
        vm.warp(END_TIME + 1);
        // Direct resolve would need to come from the factory (the resolver)
        vm.prank(address(factory));
        market.resolve(true);

        assertTrue(market.resolved());
        assertTrue(market.outcomeYes());
    }

    function test_ResolveMarket_RevertBeforeEnd() public {
        PredictionMarket market = _createMarket();

        vm.prank(address(factory));
        vm.expectRevert("PredictionMarket: market not ended");
        market.resolve(true);
    }

    function test_EmergencyResolve() public {
        PredictionMarket market = _createMarket();

        // Can resolve early via factory's resolveMarket (which calls emergencyResolve)
        factory.resolveMarket(address(market), true);
        assertTrue(market.resolved());
    }

    function test_ResolveViaFactory() public {
        PredictionMarket market = _createMarket();

        factory.resolveMarket(address(market), false);
        assertTrue(market.resolved());
        assertFalse(market.outcomeYes());
    }

    // ========================
    //       CLAIMING
    // ========================

    function test_ClaimWinnings_YesWins() public {
        PredictionMarket market = _createMarket();

        // Alice buys YES
        vm.startPrank(alice);
        usdt.approve(address(market), 100e6);
        uint256 yesTokens = market.buy(true, 100e6);
        vm.stopPrank();

        // Resolve as YES
        factory.resolveMarket(address(market), true);

        // Alice claims
        uint256 balanceBefore = usdt.balanceOf(alice);
        vm.prank(alice);
        market.claim();

        // Alice should receive collateral equal to her YES token balance
        assertEq(usdt.balanceOf(alice), balanceBefore + yesTokens);
        assertEq(market.yesToken().balanceOf(alice), 0); // tokens burned
    }

    function test_ClaimWinnings_NoWins() public {
        PredictionMarket market = _createMarket();

        // Bob buys NO
        vm.startPrank(bob);
        usdt.approve(address(market), 100e6);
        uint256 noTokens = market.buy(false, 100e6);
        vm.stopPrank();

        // Resolve as NO
        factory.resolveMarket(address(market), false);

        // Bob claims
        uint256 balanceBefore = usdt.balanceOf(bob);
        vm.prank(bob);
        market.claim();

        assertEq(usdt.balanceOf(bob), balanceBefore + noTokens);
    }

    function test_Claim_RevertIfNoWinnings() public {
        PredictionMarket market = _createMarket();

        // Alice buys YES, Bob buys NO
        vm.startPrank(alice);
        usdt.approve(address(market), 100e6);
        market.buy(true, 100e6);
        vm.stopPrank();

        // Resolve as NO — Alice loses
        factory.resolveMarket(address(market), false);

        vm.prank(alice);
        vm.expectRevert("PredictionMarket: no winnings");
        market.claim();
    }

    function test_Claim_RevertIfNotResolved() public {
        PredictionMarket market = _createMarket();

        vm.startPrank(alice);
        usdt.approve(address(market), 100e6);
        market.buy(true, 100e6);
        vm.stopPrank();

        vm.prank(alice);
        vm.expectRevert("PredictionMarket: not resolved yet");
        market.claim();
    }

    function test_Claim_RevertDoubleClaim() public {
        PredictionMarket market = _createMarket();

        vm.startPrank(alice);
        usdt.approve(address(market), 100e6);
        market.buy(true, 100e6);
        vm.stopPrank();

        factory.resolveMarket(address(market), true);

        vm.startPrank(alice);
        market.claim();
        vm.expectRevert("PredictionMarket: already claimed");
        market.claim();
        vm.stopPrank();
    }

    // ========================
    //     TRADING AFTER RESOLVE
    // ========================

    function test_Buy_RevertAfterResolve() public {
        PredictionMarket market = _createMarket();
        factory.resolveMarket(address(market), true);

        vm.startPrank(alice);
        usdt.approve(address(market), 100e6);
        vm.expectRevert("PredictionMarket: market resolved");
        market.buy(true, 100e6);
        vm.stopPrank();
    }

    // ========================
    //     VIEW FUNCTIONS
    // ========================

    function test_GetAmountOut() public {
        PredictionMarket market = _createMarket();

        uint256 quote = market.getAmountOut(true, 100e6);
        assertGt(quote, 0);

        // Actually buying should give the same result
        vm.startPrank(alice);
        usdt.approve(address(market), 100e6);
        uint256 actual = market.buy(true, 100e6);
        vm.stopPrank();

        assertEq(actual, quote);
    }

    function test_GetMarketInfo() public {
        PredictionMarket market = _createMarket();

        (
            string memory q,
            string memory cat,
            address collateral,
            uint256 end,
            bool isResolved,
            ,
            uint256 yesRes,
            uint256 noRes,
            uint256 totalCol,
            ,
            address yesAddr,
            address noAddr
        ) = market.getMarketInfo();

        assertEq(q, "Will BTC hit $100K?");
        assertEq(cat, "Crypto");
        assertEq(collateral, address(usdt));
        assertEq(end, END_TIME);
        assertFalse(isResolved);
        assertGt(yesRes, 0);
        assertGt(noRes, 0);
        assertGt(totalCol, 0);
        assertTrue(yesAddr != address(0));
        assertTrue(noAddr != address(0));
    }

    // ========================
    //     FULL LIFECYCLE
    // ========================

    function test_FullLifecycle() public {
        // 1. Create market
        PredictionMarket market = _createMarket();

        // 2. Alice buys YES
        vm.startPrank(alice);
        usdt.approve(address(market), 200e6);
        uint256 aliceYes = market.buy(true, 200e6);
        vm.stopPrank();

        // 3. Bob buys NO
        vm.startPrank(bob);
        usdt.approve(address(market), 150e6);
        uint256 bobNo = market.buy(false, 150e6);
        vm.stopPrank();

        // 4. Check prices moved
        (uint256 yesPrice, uint256 noPrice) = market.getPrices();
        assertGt(yesPrice, 5e17); // Alice's larger YES buy should dominate
        assertLt(noPrice, 5e17);

        // 5. Volume tracked
        assertGt(market.totalVolume(), 0);

        // 6. Resolve as YES (Alice wins)
        factory.resolveMarket(address(market), true);

        // 7. Alice claims
        uint256 aliceBalBefore = usdt.balanceOf(alice);
        vm.prank(alice);
        market.claim();
        assertEq(usdt.balanceOf(alice), aliceBalBefore + aliceYes);

        // 8. Bob can't claim (he has NO tokens, but YES won)
        vm.prank(bob);
        vm.expectRevert("PredictionMarket: no winnings");
        market.claim();
    }
}
