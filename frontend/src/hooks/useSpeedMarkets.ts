"use client";

import { useReadContract, useReadContracts } from "wagmi";
import { SPEED_MARKET_ADDRESS, SPEED_MARKET_ABI } from "@/lib/contracts";

export interface SpeedMarketData {
  marketId: bigint;
  asset: string;
  strikePrice: bigint;
  expiry: number;
  resolved: boolean;
  outcomeIsUp: boolean;
  reserveUp: bigint;
  reserveDown: bigint;
  totalCollateral: bigint;
  totalLpShares: bigint;
}

export function useSpeedMarkets() {
  const {
    data: nextId,
    isLoading: countLoading,
    error: countError,
  } = useReadContract({
    address: SPEED_MARKET_ADDRESS,
    abi: SPEED_MARKET_ABI,
    functionName: "nextMarketId",
    query: { refetchInterval: 15_000 },
  });

  const total = nextId ? Number(nextId as bigint) : 0;
  const startId = Math.max(0, total - 30); // Read last 30 markets

  const marketCalls = Array.from({ length: total - startId }, (_, i) => ({
    address: SPEED_MARKET_ADDRESS as `0x${string}`,
    abi: SPEED_MARKET_ABI,
    functionName: "getMarket" as const,
    args: [BigInt(startId + i)] as const,
  }));

  const {
    data: marketResults,
    isLoading: marketsLoading,
    error: marketsError,
    refetch,
  } = useReadContracts({
    contracts: marketCalls,
    query: {
      enabled: total > 0,
      refetchInterval: 15_000,
    },
  });

  const markets: SpeedMarketData[] = [];
  const now = Math.floor(Date.now() / 1000);

  if (marketResults) {
    for (let i = 0; i < marketResults.length; i++) {
      const result = marketResults[i];
      if (result?.status === "success" && result.result) {
        const r = result.result as [
          string, bigint, bigint, boolean, boolean,
          bigint, bigint, bigint, bigint,
        ];
        markets.push({
          marketId: BigInt(startId + i),
          asset: r[0],
          strikePrice: r[1],
          expiry: Number(r[2]),
          resolved: r[3],
          outcomeIsUp: r[4],
          reserveUp: r[5],
          reserveDown: r[6],
          totalCollateral: r[7],
          totalLpShares: r[8],
        });
      }
    }
  }

  const activeMarkets = markets.filter(
    (m) => !m.resolved && m.expiry > now,
  );
  const resolvedMarkets = markets
    .filter((m) => m.resolved)
    .reverse()
    .slice(0, 10);

  return {
    markets,
    activeMarkets,
    resolvedMarkets,
    isLoading: countLoading || marketsLoading,
    error: countError || marketsError,
    refetch,
  };
}
