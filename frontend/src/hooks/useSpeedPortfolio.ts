"use client";

import { useAccount, useReadContracts } from "wagmi";
import { useSpeedMarkets, type SpeedMarketData } from "./useSpeedMarkets";
import { SPEED_MARKET_ADDRESS, SPEED_MARKET_ABI } from "@/lib/contracts";
import { getEmbeddedWallet } from "@/lib/embeddedWallet";

export interface SpeedPositionData {
  market: SpeedMarketData;
  upBalance: bigint;
  downBalance: bigint;
}

export function useSpeedPortfolio() {
  const { address: mainAddress } = useAccount();
  const { markets, isLoading: marketsLoading } = useSpeedMarkets();

  const embeddedWallet = typeof window !== "undefined" ? getEmbeddedWallet() : null;
  const queryAddress = embeddedWallet?.address ?? mainAddress;

  const balanceCalls = markets.map((m) => ({
    address: SPEED_MARKET_ADDRESS as `0x${string}`,
    abi: SPEED_MARKET_ABI,
    functionName: "getUserBalances" as const,
    args: queryAddress ? [m.marketId, queryAddress] : undefined,
  }));

  const { data: balances, isLoading: balancesLoading, refetch } = useReadContracts({
    contracts: balanceCalls,
    query: { enabled: !!queryAddress && markets.length > 0 },
  });

  const positions: SpeedPositionData[] = [];

  if (balances) {
    for (let i = 0; i < markets.length; i++) {
      const result = balances[i];
      if (result?.status === "success" && result.result) {
        const [upBalance, downBalance] = result.result as [bigint, bigint];
        if (upBalance > 0n || downBalance > 0n) {
          positions.push({
            market: markets[i],
            upBalance,
            downBalance,
          });
        }
      }
    }
  }

  return {
    positions,
    isLoading: marketsLoading || balancesLoading,
    refetch,
  };
}
