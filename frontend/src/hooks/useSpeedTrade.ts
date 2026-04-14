"use client";

import { useState } from "react";
import { useWriteContract, useWaitForTransactionReceipt, useReadContract, useAccount } from "wagmi";
import { parseUnits } from "viem";
import { SPEED_MARKET_ADDRESS, SPEED_MARKET_ABI, USDT_ADDRESS, USDT_ABI } from "@/lib/contracts";

export function useSpeedBuy() {
  const { writeContractAsync, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming } = useWaitForTransactionReceipt({ hash });

  const buy = async (marketId: bigint, isUp: boolean, amount: string) => {
    const parsed = parseUnits(amount, 6);

    // Approve first
    await writeContractAsync({
      address: USDT_ADDRESS,
      abi: USDT_ABI,
      functionName: "approve",
      args: [SPEED_MARKET_ADDRESS, parsed],
    });

    // Then buy
    return writeContractAsync({
      address: SPEED_MARKET_ADDRESS,
      abi: SPEED_MARKET_ABI,
      functionName: "buy",
      args: [marketId, isUp, parsed],
    });
  };

  return { buy, hash, isLoading: isPending || isConfirming };
}

export function useSpeedClaim() {
  const { writeContractAsync, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming } = useWaitForTransactionReceipt({ hash });

  const claim = async (marketId: bigint) => {
    return writeContractAsync({
      address: SPEED_MARKET_ADDRESS,
      abi: SPEED_MARKET_ABI,
      functionName: "claim",
      args: [marketId],
    });
  };

  return { claim, hash, isLoading: isPending || isConfirming };
}

export function useSpeedUserBalances(marketId: bigint) {
  const { address } = useAccount();

  return useReadContract({
    address: SPEED_MARKET_ADDRESS,
    abi: SPEED_MARKET_ABI,
    functionName: "getUserBalances",
    args: address ? [marketId, address] : undefined,
    query: {
      enabled: !!address,
      refetchInterval: 10_000,
    },
  });
}

export function useSpeedAmountOut(marketId: bigint, isUp: boolean, amount: string) {
  const parsed = amount ? parseUnits(amount, 6) : 0n;

  return useReadContract({
    address: SPEED_MARKET_ADDRESS,
    abi: SPEED_MARKET_ABI,
    functionName: "getAmountOut",
    args: [marketId, isUp, parsed],
    query: { enabled: parsed > 0n },
  });
}
