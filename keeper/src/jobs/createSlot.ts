import { formatUnits, maxUint256 } from "viem";
import { publicClient, walletClient, account } from "../clients.js";
import { speedMarketAbi, collateralAbi } from "../abi.js";
import { getCurrentPrice, getSettlementPrice } from "../pyth.js";
import { registerPendingSlot } from "./resolveSlots.js";
import { registerResolvedMarket } from "./recycleLiquidity.js";
import {
  scanSpeedMarkets,
  findActiveMarket,
  findStaleMarkets,
  getNextMarketId,
} from "./scanMarkets.js";
import {
  SPEED_ASSETS,
  PYTH_FEED_IDS,
  SLOT_DURATION,
  INITIAL_LIQUIDITY,
  SPEED_MARKET_ADDRESS,
  COLLATERAL_ADDRESS,
} from "../config.js";

let approvalChecked = false;

async function ensureApproval() {
  if (approvalChecked) return;

  const allowance = await publicClient.readContract({
    address: COLLATERAL_ADDRESS,
    abi: collateralAbi,
    functionName: "allowance",
    args: [account.address, SPEED_MARKET_ADDRESS],
  });

  if (allowance < INITIAL_LIQUIDITY * 1000n) {
    console.log("[Keeper] Approving USDT for SpeedMarketAMM...");
    const hash = await walletClient.writeContract({
      address: COLLATERAL_ADDRESS,
      abi: collateralAbi,
      functionName: "approve",
      args: [SPEED_MARKET_ADDRESS, maxUint256],
    });
    await publicClient.waitForTransactionReceipt({ hash });
    console.log(`[Keeper] USDT approved, tx: ${hash}`);
  }

  approvalChecked = true;
}

function formatSlotTime(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "America/New_York",
  });
}

/**
 * Resolve a single stale (expired, unresolved) speed market.
 */
async function resolveStaleMarket(stale: {
  marketId: bigint;
  asset: string;
  expiry: number;
  strikePrice: bigint;
}): Promise<boolean> {
  const feedId = PYTH_FEED_IDS[stale.asset];
  if (!feedId) return false;

  if (stale.strikePrice === 0n) {
    console.warn(`[Keeper] Market #${stale.marketId}: strikePrice is 0. Cannot resolve.`);
    return false;
  }

  try {
    const { price: settlementPrice } = await getSettlementPrice(feedId, stale.expiry);
    const strike = Number(stale.strikePrice) / 1e8;
    const outcomeIsUp = settlementPrice > strike;
    const winnerName = outcomeIsUp ? "UP" : "DOWN";

    console.log(
      `[Keeper] Resolving stale #${stale.marketId} (${stale.asset}): ` +
        `strike=$${strike.toFixed(2)}, final=$${settlementPrice.toFixed(2)} → ${winnerName}`,
    );

    const hash = await walletClient.writeContract({
      address: SPEED_MARKET_ADDRESS,
      abi: speedMarketAbi,
      functionName: "resolveMarket",
      args: [stale.marketId, outcomeIsUp],
    });
    await publicClient.waitForTransactionReceipt({ hash });

    console.log(`[Keeper] Resolved stale #${stale.marketId}: ${winnerName}, tx: ${hash}`);
    registerResolvedMarket(stale.marketId);
    return true;
  } catch (err) {
    console.error(`[Keeper] Failed to resolve stale #${stale.marketId}:`, err);
    return false;
  }
}

export async function createSlotJob() {
  const now = Math.floor(Date.now() / 1000);

  // ─── Guard 1: Ensure USDT approval ─────────────────────────────────
  try {
    await ensureApproval();
  } catch (err) {
    console.error("[Keeper] Approval check failed:", err);
    return;
  }

  // ─── Guard 2: Ensure sufficient USDT balance ───────────────────────
  const balance = await publicClient.readContract({
    address: COLLATERAL_ADDRESS,
    abi: collateralAbi,
    functionName: "balanceOf",
    args: [account.address],
  });
  if (balance < INITIAL_LIQUIDITY) {
    console.error(
      `[Keeper] Insufficient USDT: ${formatUnits(balance, 6)}. Need at least ${formatUnits(INITIAL_LIQUIDITY, 6)}. Skipping.`,
    );
    return;
  }

  // ─── Guard 3: Scan on-chain state ──────────────────────────────────
  console.log("[Keeper] Scanning on-chain speed markets...");
  let speedMarkets;
  try {
    speedMarkets = await scanSpeedMarkets(80);
  } catch (err) {
    console.error("[Keeper] On-chain scan failed:", err);
    return;
  }

  // ─── Guard 4: Resolve stale markets first ──────────────────────────
  const staleMarkets = findStaleMarkets(speedMarkets, now);
  if (staleMarkets.length > 0) {
    console.log(
      `[Keeper] Found ${staleMarkets.length} stale market(s). Resolving before creating new ones...`,
    );
    for (const stale of staleMarkets) {
      await resolveStaleMarket(stale);
    }
  }

  // ─── Create new slots per asset ────────────────────────────────────
  for (const asset of SPEED_ASSETS) {
    const feedId = PYTH_FEED_IDS[asset];
    if (!feedId) continue;

    // ─── Guard 5: Skip if active market already exists ────────────────
    const existing = findActiveMarket(speedMarkets, asset, now);
    if (existing) {
      const remainingSecs = existing.expiry - now;
      console.log(
        `[Keeper] ${asset}: Active market #${existing.marketId} exists ` +
          `(${Math.floor(remainingSecs / 60)}m ${remainingSecs % 60}s left). Skipping.`,
      );
      registerPendingSlot({
        marketId: existing.marketId,
        asset,
        expiry: existing.expiry,
        strikePrice: existing.strikePrice,
      });
      continue;
    }

    // ─── Guard 6: Check balance before each creation ──────────────────
    const currentBalance = await publicClient.readContract({
      address: COLLATERAL_ADDRESS,
      abi: collateralAbi,
      functionName: "balanceOf",
      args: [account.address],
    });
    if (currentBalance < INITIAL_LIQUIDITY) {
      console.warn(`[Keeper] ${asset}: Insufficient USDT (${formatUnits(currentBalance, 6)}). Skipping.`);
      continue;
    }

    // ─── Guard 7: Pyth price freshness ────────────────────────────────
    let price: number;
    try {
      const result = await getCurrentPrice(feedId);
      price = result.price;
      if (price <= 0) {
        console.warn(`[Keeper] ${asset}: Invalid Pyth price ($${price}). Skipping.`);
        continue;
      }
    } catch (err) {
      console.error(`[Keeper] ${asset}: Pyth price fetch failed. Skipping.`, err);
      continue;
    }

    // ─── Create the market ────────────────────────────────────────────
    try {
      const strikePrice = BigInt(Math.round(price * 1e8));
      const expiry = now + SLOT_DURATION;

      console.log(
        `[Keeper] Creating ${asset} slot: strike=$${price.toFixed(2)}, ` +
          `${formatSlotTime(now)}-${formatSlotTime(expiry)} ET, ` +
          `liquidity=${formatUnits(INITIAL_LIQUIDITY, 6)} USDT`,
      );

      const hash = await walletClient.writeContract({
        address: SPEED_MARKET_ADDRESS,
        abi: speedMarketAbi,
        functionName: "createMarket",
        args: [asset, strikePrice, BigInt(expiry), INITIAL_LIQUIDITY],
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      const nextId = await getNextMarketId();
      const marketId = nextId - 1n;

      registerPendingSlot({ marketId, asset, expiry, strikePrice });

      console.log(
        `[Keeper] Created ${asset} slot #${marketId}, tx: ${hash}, block: ${receipt.blockNumber}`,
      );
    } catch (err) {
      console.error(`[Keeper] Failed to create ${asset} slot:`, err);
    }
  }
}
