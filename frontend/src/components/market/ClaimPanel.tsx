"use client";

import { useAccount } from "wagmi";
import { formatUnits } from "viem";
import { useEffect } from "react";
import { toast } from "sonner";
import { useClaim, useTokenBalance } from "@/hooks/useTrade";
import { useGaslessClaim, useGaslessAvailable } from "@/hooks/useGaslessTrade";
import type { MarketData } from "@/hooks/useMarkets";

export function ClaimPanel({ market }: { market: MarketData }) {
  const { address: userAddress } = useAccount();
  const winningToken = market.outcomeYes ? market.yesToken : market.noToken;
  const { data: winningBalance } = useTokenBalance(winningToken, userAddress);
  const { claim, isLoading, isSuccess } = useClaim(market.address);
  const { claim: gaslessClaim, isLoading: isGaslessClaiming, txHash: gaslessClaimTxHash } = useGaslessClaim(market.address);
  const gaslessAvailable = useGaslessAvailable();

  const balance = winningBalance as bigint | undefined;
  const hasWinnings = balance != null && balance > 0n;

  useEffect(() => {
    if (isSuccess) {
      toast.success("Winnings claimed!");
    }
  }, [isSuccess]);

  if (!market.resolved || !userAddress) return null;

  const handleClaim = gaslessAvailable ? gaslessClaim : claim;
  const claimLoading = isLoading || isGaslessClaiming;

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
      <h3 className="text-sm font-semibold text-zinc-300 mb-3">Claim Winnings</h3>
      <p className="text-xs text-zinc-500 mb-1">
        Market resolved: <span className="text-white font-medium">{market.outcomeYes ? "YES" : "NO"}</span>
      </p>
      <p className="text-xs text-zinc-500 mb-4">
        Your winning tokens:{" "}
        <span className="text-white font-medium">
          {hasWinnings ? parseFloat(formatUnits(balance, 6)).toFixed(2) : "0"}
        </span>
      </p>
      <button
        onClick={handleClaim}
        disabled={!hasWinnings || claimLoading}
        className="w-full py-2.5 rounded-lg text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors disabled:bg-zinc-800 disabled:text-zinc-500 disabled:cursor-not-allowed"
      >
        {claimLoading ? "Claiming..." : hasWinnings ? `Claim Winnings${gaslessAvailable ? " (Gasless)" : ""}` : "No Winnings to Claim"}
      </button>
    </div>
  );
}
