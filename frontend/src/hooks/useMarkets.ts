"use client";

import { useReadContract, useReadContracts } from "wagmi";
import { FACTORY_ADDRESS, FACTORY_ABI, MARKET_ABI } from "@/lib/contracts";

export interface MarketData {
  address: `0x${string}`;
  question: string;
  category: string;
  collateralToken: `0x${string}`;
  endTimestamp: bigint;
  resolved: boolean;
  outcomeYes: boolean;
  yesReserve: bigint;
  noReserve: bigint;
  totalCollateral: bigint;
  totalVolume: bigint;
  yesToken: `0x${string}`;
  noToken: `0x${string}`;
}

export function useMarketAddresses() {
  return useReadContract({
    address: FACTORY_ADDRESS,
    abi: FACTORY_ABI,
    functionName: "getAllMarkets",
  });
}

export function useMarkets() {
  const {
    data: rawAddresses,
    isLoading: addressesLoading,
    error: addressesError,
  } = useMarketAddresses();

  const addresses = rawAddresses as `0x${string}`[] | undefined;

  const marketInfoCalls = (addresses ?? []).map((addr) => ({
    address: addr as `0x${string}`,
    abi: MARKET_ABI,
    functionName: "getMarketInfo" as const,
  }));

  const {
    data: marketInfoResults,
    isLoading: infoLoading,
    error: infoError,
    refetch,
  } = useReadContracts({
    contracts: marketInfoCalls,
    query: { enabled: !!addresses && addresses.length > 0 },
  });

  const markets: MarketData[] = [];

  if (addresses && marketInfoResults) {
    for (let i = 0; i < addresses.length; i++) {
      const result = marketInfoResults[i];
      if (result?.status === "success" && result.result) {
        const r = result.result as [
          string, string, `0x${string}`, bigint, boolean, boolean,
          bigint, bigint, bigint, bigint, `0x${string}`, `0x${string}`,
        ];
        markets.push({
          address: addresses[i] as `0x${string}`,
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
        });
      }
    }
  }

  return {
    markets,
    isLoading: addressesLoading || infoLoading,
    error: addressesError || infoError,
    refetch,
  };
}
