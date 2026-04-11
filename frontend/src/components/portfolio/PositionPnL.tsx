"use client";

import { useQuery } from "@tanstack/react-query";
import { useReadContract } from "wagmi";
import { fetchMarketTradeEvents } from "@/lib/events";
import { MARKET_ABI } from "@/lib/contracts";
import { cn } from "@/lib/utils";

interface Props {
  marketAddress: `0x${string}`;
  userAddress: `0x${string}`;
  yesBalance: bigint;
  noBalance: bigint;
}

interface SidePnL {
  avgEntry: number;
  currentPrice: number;
  pnl: number;
  pnlPercent: number;
}

export function PositionPnL({
  marketAddress,
  userAddress,
  yesBalance,
  noBalance,
}: Props) {
  const { data: pricesData } = useReadContract({
    address: marketAddress,
    abi: MARKET_ABI,
    functionName: "getPrices",
  });

  const prices = pricesData as [bigint, bigint] | undefined;

  const { data: pnlData, isLoading } = useQuery({
    queryKey: ["positionPnL", marketAddress, userAddress],
    staleTime: 30_000,
    queryFn: async (): Promise<{
      yes: SidePnL | null;
      no: SidePnL | null;
    }> => {
      const trades = await fetchMarketTradeEvents(marketAddress, userAddress);
      if (!prices) return { yes: null, no: null };

      const yesCurrentPrice = Number(prices[0]) / 1e18;
      const noCurrentPrice = Number(prices[1]) / 1e18;

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
      }

      const computeSide = (
        cost: bigint,
        bought: bigint,
        currentPrice: number,
        balance: bigint
      ): SidePnL | null => {
        if (bought === 0n || balance === 0n) return null;
        const avgEntry =
          Number(cost) / 1e6 / (Number(bought) / 1e18);
        const balF = Number(balance) / 1e18;
        const pnl = (currentPrice - avgEntry) * balF;
        const pnlPercent =
          avgEntry > 0 ? ((currentPrice - avgEntry) / avgEntry) * 100 : 0;
        return { avgEntry, currentPrice, pnl, pnlPercent };
      };

      return {
        yes: computeSide(yesCost, yesBought, yesCurrentPrice, yesBalance),
        no: computeSide(noCost, noBought, noCurrentPrice, noBalance),
      };
    },
    enabled: !!prices,
  });

  if (isLoading || !pnlData) return null;

  const renderSide = (side: "YES" | "NO", data: SidePnL | null) => {
    if (!data) return null;
    const isPositive = data.pnl >= 0;
    return (
      <span
        className={cn(
          "text-xs",
          isPositive ? "text-emerald-400" : "text-red-400"
        )}
      >
        {side}: {(data.avgEntry * 100).toFixed(0)}c {"\u2192"}{" "}
        {(data.currentPrice * 100).toFixed(0)}c (
        {isPositive ? "+" : ""}
        {data.pnlPercent.toFixed(1)}%)
      </span>
    );
  };

  return (
    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
      {renderSide("YES", pnlData.yes)}
      {renderSide("NO", pnlData.no)}
    </div>
  );
}
