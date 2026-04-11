"use client";

import { useQuery } from "@tanstack/react-query";
import { useReadContract } from "wagmi";
import { fetchMarketTradeEvents } from "@/lib/events";
import { MARKET_ABI } from "@/lib/contracts";

export interface PnLData {
  totalCost: bigint; // USDT spent (6 decimals)
  totalTokensBought: bigint; // tokens received (18 decimals)
  avgEntryPrice: number; // 0–1 scale (e.g., 0.65 = 65 cents)
  currentPrice: number; // 0–1 scale
  currentBalance: bigint; // token balance (18 decimals)
  unrealizedPnL: number; // in USDT (decimal, e.g., 12.50)
  unrealizedPnLPercent: number; // percentage
}

export function usePositionPnL(
  marketAddress: `0x${string}`,
  userAddress: `0x${string}` | undefined
) {
  // Get current prices from contract
  const { data: pricesData } = useReadContract({
    address: marketAddress,
    abi: MARKET_ABI,
    functionName: "getPrices",
    query: { enabled: !!userAddress },
  });

  const prices = pricesData as [bigint, bigint] | undefined;
  const yesCurrentPrice = prices ? Number(prices[0]) / 1e18 : 0;
  const noCurrentPrice = prices ? Number(prices[1]) / 1e18 : 0;

  // Fetch user's trade history and compute P&L
  const { data: pnl, isLoading } = useQuery({
    queryKey: ["positionPnL", marketAddress, userAddress],
    enabled: !!userAddress,
    staleTime: 30_000,
    queryFn: async (): Promise<{ yes: PnLData | null; no: PnLData | null }> => {
      if (!userAddress) return { yes: null, no: null };

      const trades = await fetchMarketTradeEvents(marketAddress, userAddress);

      // Separate by side
      let yesCost = 0n;
      let yesBought = 0n;
      let noCost = 0n;
      let noBought = 0n;

      for (const trade of trades) {
        if (trade.type === "buy") {
          if (trade.isYes) {
            yesCost += trade.collateralAmount;
            yesBought += trade.tokenAmount;
          } else {
            noCost += trade.collateralAmount;
            noBought += trade.tokenAmount;
          }
        }
        // Sells reduce position but we track cost basis from buys only
        // (average entry price = total cost / total bought)
      }

      const computePnL = (
        totalCost: bigint,
        totalTokensBought: bigint,
        currentPrice: number,
        currentBalance: bigint
      ): PnLData | null => {
        if (totalTokensBought === 0n && currentBalance === 0n) return null;

        // avgEntryPrice in 0–1 scale
        // totalCost is 6 decimals (USDT), totalTokensBought is 18 decimals
        const avgEntryPrice =
          totalTokensBought > 0n
            ? Number(totalCost) / 1e6 / (Number(totalTokensBought) / 1e18)
            : 0;

        const balanceFloat = Number(currentBalance) / 1e18;
        const unrealizedPnL =
          (currentPrice - avgEntryPrice) * balanceFloat;
        const unrealizedPnLPercent =
          avgEntryPrice > 0
            ? ((currentPrice - avgEntryPrice) / avgEntryPrice) * 100
            : 0;

        return {
          totalCost,
          totalTokensBought,
          avgEntryPrice,
          currentPrice,
          currentBalance,
          unrealizedPnL,
          unrealizedPnLPercent,
        };
      };

      return {
        yes: computePnL(yesCost, yesBought, yesCurrentPrice, 0n), // balance filled by component
        no: computePnL(noCost, noBought, noCurrentPrice, 0n),
      };
    },
  });

  return { pnl, isLoading };
}
