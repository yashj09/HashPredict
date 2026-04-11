"use client";

import { useQuery } from "@tanstack/react-query";
import { useReadContract } from "wagmi";
import { FACTORY_ADDRESS, FACTORY_ABI } from "@/lib/contracts";
import {
  fetchMarketTradeEvents,
  fetchMarketClaimEvents,
} from "@/lib/events";

export interface LeaderboardEntry {
  address: `0x${string}`;
  totalVolume: bigint;
  totalBuyCost: bigint;
  totalSellProceeds: bigint;
  totalClaimProceeds: bigint;
  realizedPnL: bigint;
  tradeCount: number;
}

export function useLeaderboard() {
  const { data: rawAddresses } = useReadContract({
    address: FACTORY_ADDRESS,
    abi: FACTORY_ABI,
    functionName: "getAllMarkets",
  });

  const addresses = rawAddresses as `0x${string}`[] | undefined;

  return useQuery<LeaderboardEntry[]>({
    queryKey: ["leaderboard", addresses?.length],
    enabled: !!addresses && addresses.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      if (!addresses) return [];

      const userMap = new Map<
        string,
        {
          totalVolume: bigint;
          totalBuyCost: bigint;
          totalSellProceeds: bigint;
          totalClaimProceeds: bigint;
          tradeCount: number;
        }
      >();

      const getOrCreate = (addr: string) => {
        if (!userMap.has(addr)) {
          userMap.set(addr, {
            totalVolume: 0n,
            totalBuyCost: 0n,
            totalSellProceeds: 0n,
            totalClaimProceeds: 0n,
            tradeCount: 0,
          });
        }
        return userMap.get(addr)!;
      };

      // Fetch events from all markets in parallel
      const [allTrades, allClaims] = await Promise.all([
        Promise.all(addresses.map((addr) => fetchMarketTradeEvents(addr))),
        Promise.all(addresses.map((addr) => fetchMarketClaimEvents(addr))),
      ]);

      for (const trades of allTrades) {
        for (const trade of trades) {
          const entry = getOrCreate(trade.user);
          if (trade.type === "buy") {
            entry.totalBuyCost += trade.collateralAmount;
            entry.totalVolume += trade.collateralAmount;
          } else {
            entry.totalSellProceeds += trade.collateralAmount;
            entry.totalVolume += trade.collateralAmount;
          }
          entry.tradeCount++;
        }
      }

      for (const claims of allClaims) {
        for (const claim of claims) {
          const entry = getOrCreate(claim.user);
          entry.totalClaimProceeds += claim.amount;
        }
      }

      const entries: LeaderboardEntry[] = [];
      for (const [addr, data] of userMap) {
        entries.push({
          address: addr as `0x${string}`,
          realizedPnL:
            data.totalSellProceeds +
            data.totalClaimProceeds -
            data.totalBuyCost,
          ...data,
        });
      }

      return entries;
    },
  });
}
