"use client";

import { useState } from "react";
import { useAccount, useWriteContract } from "wagmi";
import { formatUnits } from "viem";
import { toast } from "sonner";
import { USDT_ADDRESS, USDT_ABI } from "@/lib/contracts";
import { useUsdtBalance } from "@/hooks/useTrade";

export default function FaucetPage() {
  const { address: userAddress } = useAccount();
  const { data: balance, refetch } = useUsdtBalance(USDT_ADDRESS, userAddress);
  const { writeContractAsync } = useWriteContract();
  const [isLoading, setIsLoading] = useState(false);

  const handleFaucet = async () => {
    setIsLoading(true);
    try {
      const hash = await writeContractAsync({
        address: USDT_ADDRESS,
        abi: USDT_ABI,
        functionName: "faucet",
        gas: 100_000n,
      });
      const { publicClient } = await import("@/lib/publicClient");
      await publicClient.waitForTransactionReceipt({ hash });
      toast.success("Received 1,000 test USDT!");
      refetch();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Faucet failed";
      toast.error(msg.length > 200 ? msg.slice(0, 200) + "..." : msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
      <div className="glass-card p-8">
        <h1 className="text-2xl font-bold text-white mb-2">Test USDT Faucet</h1>
        <p className="text-sm text-slate-400 mb-6">
          Get 1,000 test USDT on HashKey Chain Testnet to start trading on prediction markets.
        </p>

        {userAddress && balance != null && (
          <div className="mb-6 p-3 rounded-lg bg-slate-800/50">
            <p className="text-xs text-slate-500 mb-0.5">Your Balance</p>
            <p className="text-xl font-bold text-white">
              {parseFloat(formatUnits(balance as bigint, 6)).toLocaleString()} USDT
            </p>
          </div>
        )}

        <button
          onClick={handleFaucet}
          disabled={!userAddress || isLoading}
          className="w-full py-3 rounded-lg text-sm font-semibold btn-gradient-primary text-white transition-colors disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed"
        >
          {!userAddress
            ? "Connect Wallet"
            : isLoading
              ? "Minting..."
              : "Get 1,000 Test USDT"}
        </button>

        <p className="text-xs text-slate-600 mt-4">
          This is test USDT on HashKey Chain Testnet. It has no real value.
        </p>
      </div>
    </div>
  );
}
