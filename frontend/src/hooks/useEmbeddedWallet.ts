"use client";

import { useState, useEffect, useCallback } from "react";
import { useAccount, useWriteContract } from "wagmi";
import { parseUnits, formatUnits } from "viem";
import { toast } from "sonner";
import {
  getEmbeddedWallet,
  createEmbeddedWallet,
  removeEmbeddedWallet,
  type EmbeddedWallet,
} from "@/lib/embeddedWallet";
import { publicClient } from "@/lib/publicClient";
import { USDT_ABI, USDT_ADDRESS } from "@/lib/contracts";

export function useEmbeddedWallet() {
  const { address: mainAddress } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const [wallet, setWallet] = useState<EmbeddedWallet | null>(null);
  const [usdtBalance, setUsdtBalance] = useState<bigint>(0n);
  const [isDepositing, setIsDepositing] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);

  // Load wallet from localStorage on mount
  useEffect(() => {
    setWallet(getEmbeddedWallet());
  }, []);

  // Poll USDT balance of the embedded wallet
  useEffect(() => {
    if (!wallet) {
      setUsdtBalance(0n);
      return;
    }

    let cancelled = false;

    async function fetchBalance() {
      try {
        const bal = await publicClient.readContract({
          address: USDT_ADDRESS,
          abi: USDT_ABI,
          functionName: "balanceOf",
          args: [wallet!.address],
        });
        if (!cancelled) setUsdtBalance(bal as bigint);
      } catch {
        // ignore
      }
    }

    fetchBalance();
    const interval = setInterval(fetchBalance, 10_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [wallet]);

  const create = useCallback(() => {
    const w = createEmbeddedWallet();
    setWallet(w);
    toast.success("Trading wallet created!");
    return w;
  }, []);

  const remove = useCallback(() => {
    removeEmbeddedWallet();
    setWallet(null);
    setUsdtBalance(0n);
  }, []);

  /** Deposit USDT from the main wallet (MetaMask) into the embedded wallet */
  const deposit = useCallback(
    async (amount: string) => {
      if (!mainAddress || !wallet) {
        toast.error("Connect wallet and create trading wallet first");
        return;
      }

      setIsDepositing(true);
      try {
        const parsed = parseUnits(amount, 6);
        toast.info("Confirm USDT transfer to trading wallet...");
        const hash = await writeContractAsync({
          address: USDT_ADDRESS,
          abi: USDT_ABI,
          functionName: "transfer",
          args: [wallet.address, parsed],
        });
        await publicClient.waitForTransactionReceipt({ hash });

        // Refresh balance
        const bal = await publicClient.readContract({
          address: USDT_ADDRESS,
          abi: USDT_ABI,
          functionName: "balanceOf",
          args: [wallet.address],
        });
        setUsdtBalance(bal as bigint);
        toast.success(`Deposited ${amount} USDT to trading wallet`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Deposit failed";
        toast.error(msg.length > 200 ? msg.slice(0, 200) + "..." : msg);
      } finally {
        setIsDepositing(false);
      }
    },
    [mainAddress, wallet, writeContractAsync],
  );

  /** Withdraw USDT from embedded wallet back to main wallet.
   *  Uses the relayer to pay gas (embedded wallet has no HSK). */
  const withdraw = useCallback(
    async (amount: string) => {
      if (!mainAddress || !wallet) {
        toast.error("No trading wallet found");
        return;
      }

      setIsWithdrawing(true);
      try {
        const parsed = parseUnits(amount, 6);

        // Use the relay API to transfer USDT from embedded wallet back to main wallet
        const resp = await fetch("/api/relay/withdraw", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            embeddedWalletPrivateKey: wallet.privateKey,
            to: mainAddress,
            amount: parsed.toString(),
          }),
        });
        const data = await resp.json();
        if (!resp.ok) throw new Error(data.error || "Withdraw failed");

        // Refresh balance
        const bal = await publicClient.readContract({
          address: USDT_ADDRESS,
          abi: USDT_ABI,
          functionName: "balanceOf",
          args: [wallet.address],
        });
        setUsdtBalance(bal as bigint);
        toast.success(`Withdrew ${amount} USDT to main wallet`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Withdraw failed";
        toast.error(msg.length > 200 ? msg.slice(0, 200) + "..." : msg);
      } finally {
        setIsWithdrawing(false);
      }
    },
    [mainAddress, wallet],
  );

  /** Force refresh the balance */
  const refreshBalance = useCallback(async () => {
    if (!wallet) return;
    try {
      const bal = await publicClient.readContract({
        address: USDT_ADDRESS,
        abi: USDT_ABI,
        functionName: "balanceOf",
        args: [wallet.address],
      });
      setUsdtBalance(bal as bigint);
    } catch {
      // ignore
    }
  }, [wallet]);

  return {
    wallet,
    usdtBalance,
    formattedBalance: formatUnits(usdtBalance, 6),
    create,
    remove,
    deposit,
    withdraw,
    refreshBalance,
    isDepositing,
    isWithdrawing,
    hasWallet: wallet !== null,
  };
}
