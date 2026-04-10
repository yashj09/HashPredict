"use client";

import { useReadContract } from "wagmi";
import { MARKET_ABI } from "@/lib/contracts";
import type { MarketData } from "./useMarkets";

export function useMarket(address: `0x${string}`) {
  const { data, isLoading, error, refetch } = useReadContract({
    address,
    abi: MARKET_ABI,
    functionName: "getMarketInfo",
  });

  let market: MarketData | null = null;

  if (data) {
    const r = data as [
      string, string, `0x${string}`, bigint, boolean, boolean,
      bigint, bigint, bigint, bigint, `0x${string}`, `0x${string}`,
    ];
    market = {
      address,
      question: r[0],
      category: r[1],
      collateralToken: r[2],
      endTimestamp: r[3],
      resolved: r[4],
      outcomeYes: r[5],
      yesReserve: r[6],
      noReserve: r[7],
      totalCollateral: r[8],
      totalVolume: r[9],
      yesToken: r[10],
      noToken: r[11],
    };
  }

  return { market, isLoading, error, refetch };
}

export function useMarketPrices(address: `0x${string}`) {
  const { data, isLoading, refetch } = useReadContract({
    address,
    abi: MARKET_ABI,
    functionName: "getPrices",
  });

  const prices = data as [bigint, bigint] | undefined;

  return {
    yesPrice: prices?.[0] ?? 0n,
    noPrice: prices?.[1] ?? 0n,
    isLoading,
    refetch,
  };
}
