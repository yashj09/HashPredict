"use client";

import { useState } from "react";
import { useReadContract, useWriteContract } from "wagmi";
import { SUPRA_RESOLVER_ADDRESS, fetchSupraProof, getPairLabel } from "@/lib/supra";
import supraResolverAbi from "@/lib/supra_resolver_abi.json";
import type { Abi } from "viem";
import { publicClient } from "@/lib/publicClient";
import { toast } from "sonner";

const SUPRA_RESOLVER_ABI = supraResolverAbi as unknown as Abi;

export interface OracleConfig {
  pairId: number;
  targetPrice: bigint;
  resolveYesIfAbove: boolean;
  configured: boolean;
}

export function useOracleConfig(marketAddress: `0x${string}`) {
  const { data, isLoading } = useReadContract({
    address: SUPRA_RESOLVER_ADDRESS,
    abi: SUPRA_RESOLVER_ABI,
    functionName: "getConfig",
    args: [marketAddress],
    query: {
      enabled: SUPRA_RESOLVER_ADDRESS !== "0x0000000000000000000000000000000000000000",
    },
  });

  const config = data as
    | { pairId: number; targetPrice: bigint; resolveYesIfAbove: boolean; configured: boolean }
    | undefined;

  if (!config || !config.configured) {
    return { config: null, isLoading };
  }

  return {
    config: {
      pairId: Number(config.pairId),
      targetPrice: config.targetPrice,
      resolveYesIfAbove: config.resolveYesIfAbove,
      configured: config.configured,
      pairLabel: getPairLabel(Number(config.pairId)),
    },
    isLoading,
  };
}

export function useResolveWithOracle(marketAddress: `0x${string}`) {
  const { config } = useOracleConfig(marketAddress);
  const { writeContractAsync } = useWriteContract();
  const [isLoading, setIsLoading] = useState(false);

  const resolve = async () => {
    if (!config) return;
    setIsLoading(true);

    try {
      toast.info("Fetching oracle price data...");
      const proofBytes = await fetchSupraProof([config.pairId]);

      toast.info("Submitting oracle resolution...");
      const hash = await writeContractAsync({
        address: SUPRA_RESOLVER_ADDRESS,
        abi: SUPRA_RESOLVER_ABI,
        functionName: "resolveWithPrice",
        args: [marketAddress, proofBytes],
        gas: 1_000_000n,
      });

      toast.info("Waiting for confirmation...");
      await publicClient.waitForTransactionReceipt({ hash });
      toast.success("Market resolved via oracle!");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Resolution failed";
      toast.error(message.slice(0, 120));
    } finally {
      setIsLoading(false);
    }
  };

  return { resolve, isLoading, hasConfig: !!config };
}
