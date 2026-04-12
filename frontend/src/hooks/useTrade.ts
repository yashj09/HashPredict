"use client";

import { useState } from "react";
import { useWriteContract, useWaitForTransactionReceipt, useReadContract } from "wagmi";
import { parseUnits } from "viem";
import { toast } from "sonner";
import { MARKET_ABI, USDT_ABI, ERC20_ABI } from "@/lib/contracts";
import { publicClient } from "@/lib/publicClient";

export function useApproveAndBuy(
  marketAddress: `0x${string}`,
  collateralToken: `0x${string}`,
) {
  const { writeContractAsync } = useWriteContract();
  const [isProcessing, setIsProcessing] = useState(false);
  const [buyTxHash, setBuyTxHash] = useState<`0x${string}` | undefined>();
  const [isBuyConfirmed, setIsBuyConfirmed] = useState(false);

  const executeBuy = async (isYes: boolean, amount: string, decimals: number = 6) => {
    const parsed = parseUnits(amount, decimals);
    setIsProcessing(true);
    setIsBuyConfirmed(false);
    try {
      toast.info("Approving USDT spend...");
      const approveHash = await writeContractAsync({
        address: collateralToken,
        abi: USDT_ABI,
        functionName: "approve",
        args: [marketAddress, parsed],
        gas: 100_000n,
      });
      toast.info("Waiting for approval confirmation...");
      await publicClient.waitForTransactionReceipt({ hash: approveHash });

      toast.info("Sending buy transaction...");
      const hash = await writeContractAsync({
        address: marketAddress,
        abi: MARKET_ABI,
        functionName: "buy",
        args: [isYes, parsed],
        gas: 800_000n,
      });
      setBuyTxHash(hash);
      toast.info("Waiting for buy confirmation...");
      await publicClient.waitForTransactionReceipt({ hash });
      setIsBuyConfirmed(true);
      toast.success("Trade confirmed!");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Transaction failed";
      toast.error(msg.length > 200 ? msg.slice(0, 200) + "..." : msg);
    } finally {
      setIsProcessing(false);
    }
  };

  return {
    executeBuy,
    isLoading: isProcessing,
    isBuyConfirmed,
    buyTxHash,
  };
}

export function useApproveAndSell(
  marketAddress: `0x${string}`,
  tokenAddress: `0x${string}`,
) {
  const { writeContractAsync } = useWriteContract();
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSellConfirmed, setIsSellConfirmed] = useState(false);
  const [sellTxHash, setSellTxHash] = useState<`0x${string}` | undefined>();

  const executeSell = async (isYes: boolean, amount: string, decimals: number = 6) => {
    const parsed = parseUnits(amount, decimals);
    setIsProcessing(true);
    setIsSellConfirmed(false);
    try {
      toast.info("Approving token spend...");
      const approveHash = await writeContractAsync({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [marketAddress, parsed],
        gas: 100_000n,
      });
      toast.info("Waiting for approval confirmation...");
      await publicClient.waitForTransactionReceipt({ hash: approveHash });

      toast.info("Sending sell transaction...");
      const hash = await writeContractAsync({
        address: marketAddress,
        abi: MARKET_ABI,
        functionName: "sell",
        args: [isYes, parsed],
        gas: 800_000n,
      });
      setSellTxHash(hash);
      toast.info("Waiting for sell confirmation...");
      await publicClient.waitForTransactionReceipt({ hash });
      setIsSellConfirmed(true);
      toast.success("Trade confirmed!");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Transaction failed";
      toast.error(msg.length > 200 ? msg.slice(0, 200) + "..." : msg);
    } finally {
      setIsProcessing(false);
    }
  };

  return {
    executeSell,
    isLoading: isProcessing,
    isSellConfirmed,
    sellTxHash,
  };
}

export function useClaim(marketAddress: `0x${string}`) {
  const { writeContractAsync } = useWriteContract();
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();

  const claim = async () => {
    setIsLoading(true);
    try {
      const hash = await writeContractAsync({
        address: marketAddress,
        abi: MARKET_ABI,
        functionName: "claim",
        gas: 300_000n,
      });
      setTxHash(hash);
      await publicClient.waitForTransactionReceipt({ hash });
      setIsSuccess(true);
      toast.success("Winnings claimed!");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Claim failed";
      toast.error(msg.length > 200 ? msg.slice(0, 200) + "..." : msg);
    } finally {
      setIsLoading(false);
    }
  };

  return { claim, isLoading, isSuccess, txHash };
}

export function useTokenBalance(tokenAddress: `0x${string}`, userAddress: `0x${string}` | undefined) {
  return useReadContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: userAddress ? [userAddress] : undefined,
    query: { enabled: !!userAddress },
  });
}

export function useUsdtBalance(usdtAddress: `0x${string}`, userAddress: `0x${string}` | undefined) {
  return useReadContract({
    address: usdtAddress,
    abi: USDT_ABI,
    functionName: "balanceOf",
    args: userAddress ? [userAddress] : undefined,
    query: { enabled: !!userAddress },
  });
}
