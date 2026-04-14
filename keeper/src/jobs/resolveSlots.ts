import { publicClient, walletClient } from "../clients.js";
import { speedMarketAbi } from "../abi.js";
import { getSettlementPrice } from "../pyth.js";
import { registerResolvedMarket } from "./recycleLiquidity.js";
import {
  PYTH_FEED_IDS,
  SPEED_MARKET_ADDRESS,
} from "../config.js";

export interface PendingSlot {
  marketId: bigint;
  asset: string;
  expiry: number;
  strikePrice: bigint;
}

const pendingSlots: PendingSlot[] = [];

/** Register a slot for future resolution. Deduplicates by marketId. */
export function registerPendingSlot(slot: PendingSlot) {
  if (pendingSlots.some((s) => s.marketId === slot.marketId)) return;
  pendingSlots.push(slot);
}

export async function resolveSlotsJob() {
  const now = Math.floor(Date.now() / 1000);
  const toResolve = pendingSlots.filter((s) => s.expiry <= now);

  if (toResolve.length === 0) return;

  for (const slot of toResolve) {
    const feedId = PYTH_FEED_IDS[slot.asset];
    if (!feedId) continue;

    try {
      // Check if already resolved on-chain
      const market = await publicClient.readContract({
        address: SPEED_MARKET_ADDRESS,
        abi: speedMarketAbi,
        functionName: "getMarket",
        args: [slot.marketId],
      });

      // getMarket returns: [asset, strikePrice, expiry, resolved, outcomeIsUp, ...]
      const resolved = market[3] as boolean;
      if (resolved) {
        const idx = pendingSlots.indexOf(slot);
        if (idx !== -1) pendingSlots.splice(idx, 1);
        registerResolvedMarket(slot.marketId);
        continue;
      }

      const onChainExpiry = Number(market[2]);
      if (onChainExpiry > now) continue; // Not expired yet

      // Get strikePrice from on-chain if needed
      let strikePrice = slot.strikePrice;
      if (strikePrice === 0n) {
        strikePrice = market[1] as bigint;
        if (strikePrice === 0n) {
          console.warn(`[Keeper] Market #${slot.marketId}: strikePrice is 0 on-chain. Cannot resolve.`);
          continue;
        }
        slot.strikePrice = strikePrice;
      }

      // Fetch settlement price at expiry from Pyth Benchmarks
      const { price: settlementPrice } = await getSettlementPrice(feedId, onChainExpiry);

      const strike = Number(strikePrice) / 1e8;
      const outcomeIsUp = settlementPrice > strike;
      const winnerName = outcomeIsUp ? "UP" : "DOWN";

      console.log(
        `[Keeper] Resolving #${slot.marketId} (${slot.asset}): ` +
          `strike=$${strike.toFixed(2)}, final=$${settlementPrice.toFixed(2)} → ${winnerName}`,
      );

      const hash = await walletClient.writeContract({
        address: SPEED_MARKET_ADDRESS,
        abi: speedMarketAbi,
        functionName: "resolveMarket",
        args: [slot.marketId, outcomeIsUp],
      });

      await publicClient.waitForTransactionReceipt({ hash });

      console.log(`[Keeper] Resolved #${slot.marketId}: ${winnerName}, tx: ${hash}`);

      registerResolvedMarket(slot.marketId);

      const idx = pendingSlots.indexOf(slot);
      if (idx !== -1) pendingSlots.splice(idx, 1);
    } catch (err) {
      const delay = now - slot.expiry;
      console.error(`[Keeper] Failed to resolve #${slot.marketId} (${delay}s late):`, err);
    }
  }
}

/** Get current pending slots (for health check) */
export function getPendingSlots() {
  return pendingSlots.map((s) => ({
    marketId: s.marketId.toString(),
    asset: s.asset,
    expiry: s.expiry,
    secondsUntilExpiry: s.expiry - Math.floor(Date.now() / 1000),
  }));
}
