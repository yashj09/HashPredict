"use client";

import { useWriteContract, useWaitForTransactionReceipt, useReadContract, useAccount } from "wagmi";
import { parseUnits } from "viem";
import { MARKET_ABI, USDT_ABI, ERC20_ABI } from "@/lib/contracts";

export function useApproveAndBuy(
  marketAddress: `0x${string}`,
  collateralToken: `0x${string}`,
) {
  const { writeContract: approve, data: approveTxHash, isPending: isApproving } = useWriteContract();
  const { writeContract: buy, data: buyTxHash, isPending: isBuying } = useWriteContract();

  const { isLoading: isApproveConfirming } = useWaitForTransactionReceipt({
    hash: approveTxHash,
  });

  const { isLoading: isBuyConfirming, isSuccess: isBuyConfirmed } = useWaitForTransactionReceipt({
    hash: buyTxHash,
  });

  const executeBuy = (isYes: boolean, amount: string, decimals: number = 6) => {
    const parsed = parseUnits(amount, decimals);
    approve(
      {
        address: collateralToken,
        abi: USDT_ABI,
        functionName: "approve",
        args: [marketAddress, parsed],
      },
      {
        onSuccess: () => {
          buy({
            address: marketAddress,
            abi: MARKET_ABI,
            functionName: "buy",
            args: [isYes, parsed],
          });
        },
      },
    );
  };

  return {
    executeBuy,
    isLoading: isApproving || isApproveConfirming || isBuying || isBuyConfirming,
    isBuyConfirmed,
    buyTxHash,
  };
}

export function useApproveAndSell(
  marketAddress: `0x${string}`,
  tokenAddress: `0x${string}`,
) {
  const { writeContract: approve, data: approveTxHash, isPending: isApproving } = useWriteContract();
  const { writeContract: sell, data: sellTxHash, isPending: isSelling } = useWriteContract();

  const { isLoading: isApproveConfirming } = useWaitForTransactionReceipt({
    hash: approveTxHash,
  });

  const { isLoading: isSellConfirming, isSuccess: isSellConfirmed } = useWaitForTransactionReceipt({
    hash: sellTxHash,
  });

  const executeSell = (isYes: boolean, amount: string, decimals: number = 18) => {
    const parsed = parseUnits(amount, decimals);
    approve(
      {
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [marketAddress, parsed],
      },
      {
        onSuccess: () => {
          sell({
            address: marketAddress,
            abi: MARKET_ABI,
            functionName: "sell",
            args: [isYes, parsed],
          });
        },
      },
    );
  };

  return {
    executeSell,
    isLoading: isApproving || isApproveConfirming || isSelling || isSellConfirming,
    isSellConfirmed,
    sellTxHash,
  };
}

export function useClaim(marketAddress: `0x${string}`) {
  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const claim = () => {
    writeContract({
      address: marketAddress,
      abi: MARKET_ABI,
      functionName: "claim",
    });
  };

  return { claim, isLoading: isPending || isConfirming, isSuccess, txHash };
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
