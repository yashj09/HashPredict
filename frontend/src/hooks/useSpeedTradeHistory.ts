"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchSpeedTradeEvents, enrichWithTimestamps } from "@/lib/speedEvents";

export interface SpeedTradeRecord {
  user: `0x${string}`;
  type: "buy" | "sell";
  side: "UP" | "DOWN";
  collateralAmount: bigint;
  tokenAmount: bigint;
  txHash: `0x${string}`;
  timestamp: number;
}

export function useSpeedTradeHistory(marketId: bigint) {
  return useQuery<SpeedTradeRecord[]>({
    queryKey: ["speedTradeHistory", marketId.toString()],
    staleTime: 10_000,
    refetchInterval: 10_000,
    retry: 1,
    queryFn: async () => {
      const events = await fetchSpeedTradeEvents(marketId);
      if (events.length === 0) return [];

      const timestamps = await enrichWithTimestamps(
        events.map((e) => e.blockNumber),
      );

      return events
        .map((e) => ({
          user: e.user,
          type: e.type,
          side: (e.isUp ? "UP" : "DOWN") as "UP" | "DOWN",
          collateralAmount: e.collateralAmount,
          tokenAmount: e.tokenAmount,
          txHash: e.txHash,
          timestamp: timestamps.get(e.blockNumber) ?? 0,
        }))
        .reverse(); // newest first
    },
  });
}
