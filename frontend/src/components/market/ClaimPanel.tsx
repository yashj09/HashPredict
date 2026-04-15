"use client";

import { useAccount } from "wagmi";
import { formatUnits } from "viem";
import { useState, useEffect } from "react";
import { useGaslessClaim, useGaslessAvailable } from "@/hooks/useGaslessTrade";
import { useEmbeddedWallet } from "@/hooks/useEmbeddedWallet";
import type { MarketData } from "@/hooks/useMarkets";
import { publicClient } from "@/lib/publicClient";
import { ERC20_ABI } from "@/lib/contracts";

export function ClaimPanel({ market }: { market: MarketData }) {
  const { address: userAddress } = useAccount();
  const { wallet } = useEmbeddedWallet();
  const gaslessAvailable = useGaslessAvailable();
  const winningToken = market.outcomeYes ? market.yesToken : market.noToken;

  const { claim: gaslessClaim, isLoading: isGaslessClaiming } = useGaslessClaim(market.address);

  // Read winning balance from embedded wallet
  const [winningBalance, setWinningBalance] = useState<bigint>(0n);
  useEffect(() => {
    if (!wallet) return;
    publicClient.readContract({
      address: winningToken,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [wallet.address],
    }).then((bal) => setWinningBalance(bal as bigint)).catch(() => {});
  }, [wallet, winningToken]);

  const hasWinnings = winningBalance > 0n;

  if (!market.resolved || !userAddress) return null;

  return (
    <div className="glass-card p-5">
      <h3 className="text-sm font-semibold text-slate-300 mb-3">Claim Winnings</h3>
      <p className="text-xs text-slate-500 mb-1">
        Market resolved: <span className="text-white font-medium">{market.outcomeYes ? "YES" : "NO"}</span>
      </p>
      <p className="text-xs text-slate-500 mb-4">
        Your winning tokens:{" "}
        <span className="text-white font-medium">
          {hasWinnings ? parseFloat(formatUnits(winningBalance, 6)).toFixed(2) : "0"}
        </span>
      </p>
      <button
        onClick={gaslessClaim}
        disabled={!hasWinnings || isGaslessClaiming || !wallet}
        className="w-full py-2.5 rounded-lg text-sm font-semibold btn-gradient-up text-white transition-colors disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed"
      >
        {isGaslessClaiming ? "Claiming..." : hasWinnings ? "Claim Winnings" : "No Winnings to Claim"}
      </button>
    </div>
  );
}
