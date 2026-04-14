import { publicClient, walletClient, account } from "../clients.js";
import { speedMarketAbi } from "../abi.js";
import { SPEED_MARKET_ADDRESS } from "../config.js";
import { formatUnits } from "viem";

// Track resolved markets that need LP recovery
const resolvedMarkets: bigint[] = [];
// Don't retry markets that permanently failed
const failedMarkets = new Set<string>();

export function registerResolvedMarket(marketId: bigint) {
  const key = marketId.toString();
  if (failedMarkets.has(key)) return;
  if (resolvedMarkets.includes(marketId)) return;
  resolvedMarkets.push(marketId);
}

/**
 * Recycle capital from resolved speed markets.
 *
 * Strategy:
 *   1. Try `claim` FIRST — if the keeper (as LP) holds any winning
 *      tokens, claim them for USDT. This is the most reliable recovery.
 *   2. Try `removeLiquidity` — this works when reserves are balanced.
 *      If it fails, accept the loss. The LP seed minus whatever was
 *      recovered is the cost of running the market.
 */
export async function recycleLiquidityJob() {
  if (resolvedMarkets.length === 0) return;

  const toRecycle = [...resolvedMarkets];
  resolvedMarkets.length = 0;

  for (const marketId of toRecycle) {
    // Step 1: Claim winning tokens the keeper holds (most reliable)
    try {
      const hash = await walletClient.writeContract({
        address: SPEED_MARKET_ADDRESS,
        abi: speedMarketAbi,
        functionName: "claim",
        args: [marketId],
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      console.log(`[Keeper] Claimed winnings from market ${marketId}, tx: ${hash}`);
    } catch {
      // No winning tokens to claim — expected if keeper's LP was on losing side
    }

    // Step 2: Try to remove LP liquidity (may fail if reserves are unbalanced)
    try {
      const lpBalance = await publicClient.readContract({
        address: SPEED_MARKET_ADDRESS,
        abi: speedMarketAbi,
        functionName: "lpBalances",
        args: [marketId, account.address],
      });

      if (lpBalance > 0n) {
        const hash = await walletClient.writeContract({
          address: SPEED_MARKET_ADDRESS,
          abi: speedMarketAbi,
          functionName: "removeLiquidity",
          args: [marketId, lpBalance],
        });
        await publicClient.waitForTransactionReceipt({ hash });
        console.log(
          `[Keeper] Recovered LP from market ${marketId}, lp=${formatUnits(lpBalance, 6)}, tx: ${hash}`,
        );
      }
    } catch (err: any) {
      const msg = String(err?.message || "");
      if (
        msg.includes("InsufficientBalance") ||
        msg.includes("invalid shares") ||
        msg.includes("InsufficientLiquidity")
      ) {
        console.log(
          `[Keeper] Market ${marketId}: LP not fully recoverable (tokens consumed by trades). This is expected.`,
        );
        failedMarkets.add(marketId.toString());
      } else {
        console.error(`[Keeper] Failed to recycle market ${marketId}:`, err);
        // Re-queue for retry (might be a transient error)
        resolvedMarkets.push(marketId);
      }
    }
  }
}
