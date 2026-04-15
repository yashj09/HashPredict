"use client";

import { useQuery } from "@tanstack/react-query";
import { useReadContract } from "wagmi";
import { FACTORY_ADDRESS, FACTORY_ABI } from "@/lib/contracts";
import {
  fetchMarketTradeEvents,
  fetchMarketClaimEvents,
} from "@/lib/events";
import {
  fetchAllSpeedTrades,
  fetchAllSpeedClaims,
} from "@/lib/speedEvents";

export interface LeaderboardEntry {
  address: `0x${string}`;
  totalVolume: bigint;
  totalBuyCost: bigint;
  totalSellProceeds: bigint;
  totalClaimProceeds: bigint;
  realizedPnL: bigint;
  tradeCount: number;
  // Breakdown
  regularTrades: number;
  speedTrades: number;
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
    enabled: !!addresses,
    staleTime: 30_000,
    refetchInterval: 30_000,
    retry: 1,
    queryFn: async () => {
      const userMap = new Map<
        string,
        {
          totalVolume: bigint;
          totalBuyCost: bigint;
          totalSellProceeds: bigint;
          totalClaimProceeds: bigint;
          tradeCount: number;
          regularTrades: number;
          speedTrades: number;
        }
      >();

      const getOrCreate = (addr: string) => {
        const lower = addr.toLowerCase();
        if (!userMap.has(lower)) {
          userMap.set(lower, {
            totalVolume: 0n,
            totalBuyCost: 0n,
            totalSellProceeds: 0n,
            totalClaimProceeds: 0n,
            tradeCount: 0,
            regularTrades: 0,
            speedTrades: 0,
          });
        }
        return userMap.get(lower)!;
      };

      // Fetch regular market events + speed market events in parallel
      const [regularTrades, regularClaims, speedTrades, speedClaims] = await Promise.all([
        addresses && addresses.length > 0
          ? Promise.all(addresses.map((addr) => fetchMarketTradeEvents(addr)))
          : Promise.resolve([]),
        addresses && addresses.length > 0
          ? Promise.all(addresses.map((addr) => fetchMarketClaimEvents(addr)))
          : Promise.resolve([]),
        fetchAllSpeedTrades(),
        fetchAllSpeedClaims(),
      ]);

      // Process regular market trades
      for (const trades of regularTrades) {
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
          entry.regularTrades++;
        }
      }

      // Process regular market claims
      for (const claims of regularClaims) {
        for (const claim of claims) {
          const entry = getOrCreate(claim.user);
          entry.totalClaimProceeds += claim.amount;
        }
      }

      // Process speed market trades
      for (const trade of speedTrades) {
        const entry = getOrCreate(trade.user);
        if (trade.type === "buy") {
          entry.totalBuyCost += trade.collateralAmount;
          entry.totalVolume += trade.collateralAmount;
        } else {
          entry.totalSellProceeds += trade.collateralAmount;
          entry.totalVolume += trade.collateralAmount;
        }
        entry.tradeCount++;
        entry.speedTrades++;
      }

      // Process speed market claims
      for (const claim of speedClaims) {
        const entry = getOrCreate(claim.user);
        entry.totalClaimProceeds += claim.amount;
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
