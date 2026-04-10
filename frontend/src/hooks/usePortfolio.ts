"use client";

import { useAccount, useReadContracts } from "wagmi";
import { useMarkets, type MarketData } from "./useMarkets";
import { ERC20_ABI } from "@/lib/contracts";

export interface PositionData {
  market: MarketData;
  yesBalance: bigint;
  noBalance: bigint;
}

export function usePortfolio() {
  const { address: userAddress } = useAccount();
  const { markets, isLoading: marketsLoading } = useMarkets();

  // Build multicall for all YES and NO token balances
  const balanceCalls = markets.flatMap((m) => [
    {
      address: m.yesToken,
      abi: ERC20_ABI,
      functionName: "balanceOf" as const,
      args: userAddress ? [userAddress] : undefined,
    },
    {
      address: m.noToken,
      abi: ERC20_ABI,
      functionName: "balanceOf" as const,
      args: userAddress ? [userAddress] : undefined,
    },
  ]);

  const { data: balances, isLoading: balancesLoading } = useReadContracts({
    contracts: balanceCalls,
    query: { enabled: !!userAddress && markets.length > 0 },
  });

  const positions: PositionData[] = [];

  if (balances) {
    for (let i = 0; i < markets.length; i++) {
      const yesResult = balances[i * 2];
      const noResult = balances[i * 2 + 1];
      const yesBalance = (yesResult?.status === "success" ? yesResult.result : 0n) as bigint;
      const noBalance = (noResult?.status === "success" ? noResult.result : 0n) as bigint;

      if (yesBalance > 0n || noBalance > 0n) {
        positions.push({
          market: markets[i],
          yesBalance,
          noBalance,
        });
      }
    }
  }

  return {
    positions,
    isLoading: marketsLoading || balancesLoading,
  };
}
