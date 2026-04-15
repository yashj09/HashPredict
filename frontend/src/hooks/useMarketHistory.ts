"use client";

import { useQuery } from "@tanstack/react-query";
import {
  fetchMarketTradeEvents,
  enrichWithTimestamps,
  type TradeEvent,
} from "@/lib/events";

export interface TradeRecord {
  timestamp: number;
  user: `0x${string}`;
  type: "buy" | "sell";
  side: "YES" | "NO";
  collateralAmount: bigint;
  tokenAmount: bigint;
  txHash: `0x${string}`;
}

export function useMarketTradeHistory(marketAddress: `0x${string}`) {
  return useQuery<TradeRecord[]>({
    queryKey: ["marketTrades", marketAddress],
    staleTime: 10_000,
    refetchInterval: 10_000,
    retry: 1,
    queryFn: async () => {
      const events = await fetchMarketTradeEvents(marketAddress);
      if (events.length === 0) return [];

      const timestamps = await enrichWithTimestamps(
        events.map((e) => e.blockNumber)
      );

      return events
        .map(
          (e: TradeEvent): TradeRecord => ({
            timestamp: timestamps.get(e.blockNumber) ?? 0,
            user: e.user,
            type: e.type,
            side: e.isYes ? "YES" : "NO",
            collateralAmount: e.collateralAmount,
            tokenAmount: e.tokenAmount,
            txHash: e.txHash,
          })
        )
        .reverse(); // newest first
    },
  });
}
