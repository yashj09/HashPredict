import { publicClient } from "../clients.js";
import { speedMarketAbi } from "../abi.js";
import { SPEED_MARKET_ADDRESS } from "../config.js";

/**
 * A speed market found on-chain via getMarket().
 */
export interface OnChainSpeedMarket {
  marketId: bigint;
  asset: string;
  strikePrice: bigint;
  expiry: number;
  resolved: boolean;
  outcomeIsUp: boolean;
}

/**
 * Read full market data from the contract's getMarket() function.
 * Returns null on error (e.g., market doesn't exist).
 */
async function readMarketFull(marketId: bigint) {
  try {
    return await publicClient.readContract({
      address: SPEED_MARKET_ADDRESS,
      abi: speedMarketAbi,
      functionName: "getMarket",
      args: [marketId],
    });
  } catch {
    return null;
  }
}

/**
 * Scan recent on-chain speed markets.
 * Reads from getMarket() which returns the struct fields directly.
 */
export async function scanSpeedMarkets(maxScan = 50): Promise<OnChainSpeedMarket[]> {
  const nextId = await publicClient.readContract({
    address: SPEED_MARKET_ADDRESS,
    abi: speedMarketAbi,
    functionName: "nextMarketId",
  });

  const total = Number(nextId);
  if (total === 0) return [];

  const startId = Math.max(0, total - maxScan);
  const results: OnChainSpeedMarket[] = [];

  // Fetch in batches of 10 for speed
  for (let batch = startId; batch < total; batch += 10) {
    const batchEnd = Math.min(batch + 10, total);
    const reads = Array.from({ length: batchEnd - batch }, async (_, i) => {
      const id = BigInt(batch + i);
      const market = await readMarketFull(id);
      if (!market) return null;

      // getMarket returns: [asset, strikePrice, expiry, resolved, outcomeIsUp, reserveUp, reserveDown, totalCollateral, totalLpShares]
      return {
        marketId: id,
        asset: market[0] as string,
        strikePrice: market[1] as bigint,
        expiry: Number(market[2]),
        resolved: market[3] as boolean,
        outcomeIsUp: market[4] as boolean,
      } satisfies OnChainSpeedMarket;
    });

    const batchResults = await Promise.all(reads);
    for (const r of batchResults) {
      if (r) results.push(r);
    }
  }

  return results;
}

/**
 * Get the active (unexpired, unresolved) speed market for a given asset.
 */
export function findActiveMarket(
  markets: OnChainSpeedMarket[],
  asset: string,
  now: number,
): OnChainSpeedMarket | null {
  return (
    markets.find(
      (m) => m.asset === asset && !m.resolved && m.expiry > now,
    ) ?? null
  );
}

/**
 * Get all expired-but-unresolved speed markets.
 */
export function findStaleMarkets(
  markets: OnChainSpeedMarket[],
  now: number,
): OnChainSpeedMarket[] {
  return markets.filter((m) => !m.resolved && m.expiry <= now);
}

/**
 * Get the total market count.
 */
export async function getNextMarketId(): Promise<bigint> {
  return publicClient.readContract({
    address: SPEED_MARKET_ADDRESS,
    abi: speedMarketAbi,
    functionName: "nextMarketId",
  });
}
