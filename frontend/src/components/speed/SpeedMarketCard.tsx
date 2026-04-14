"use client";

import { useState, useEffect } from "react";
import { formatUnits, parseUnits } from "viem";
import { useAccount } from "wagmi";
import { toast } from "sonner";
import type { SpeedMarketData } from "@/hooks/useSpeedMarkets";
import { useSpeedBuy, useSpeedClaim, useSpeedUserBalances } from "@/hooks/useSpeedTrade";
import { useGaslessSpeedBuy, useGaslessSpeedClaim } from "@/hooks/useGaslessSpeedTrade";
import { usePythPrice } from "@/hooks/usePythPrice";
import { cn, formatUSDT } from "@/lib/utils";
import { getEmbeddedWallet } from "@/lib/embeddedWallet";

function useCountdown(expiry: number) {
  const [remaining, setRemaining] = useState(expiry - Math.floor(Date.now() / 1000));

  useEffect(() => {
    const timer = setInterval(() => {
      setRemaining(expiry - Math.floor(Date.now() / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [expiry]);

  return remaining;
}

function formatCountdown(seconds: number): string {
  if (seconds <= 0) return "00:00";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function formatStrikePrice(strikePrice: bigint): string {
  const price = Number(strikePrice) / 1e8;
  if (price >= 1000) return price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}

const QUICK_AMOUNTS = ["5", "10", "25", "100"];

export function SpeedMarketCard({ market }: { market: SpeedMarketData }) {
  const { address } = useAccount();
  const remaining = useCountdown(market.expiry);
  const { data: livePrice } = usePythPrice(market.asset);
  const { data: userBalances } = useSpeedUserBalances(market.marketId);

  const { buy, isLoading: buyLoading } = useSpeedBuy();
  const { claim, isLoading: claimLoading } = useSpeedClaim();
  const { executeBuy: gaslessBuy, isLoading: gaslessBuyLoading } = useGaslessSpeedBuy();
  const { claim: gaslessClaim, isLoading: gaslessClaimLoading } = useGaslessSpeedClaim();

  const [amount, setAmount] = useState("10");
  const [useGasless, setUseGasless] = useState(false);

  const embeddedWallet = typeof window !== "undefined" ? getEmbeddedWallet() : null;

  // Probability from CPMM reserves
  const totalReserve = market.reserveUp + market.reserveDown;
  const upPercent = totalReserve > 0n
    ? Number((market.reserveDown * 10000n) / totalReserve) / 100
    : 50;
  const downPercent = 100 - upPercent;

  // Timer color
  const timerColor = remaining > 300 ? "text-emerald-400" : remaining > 60 ? "text-amber-400" : "text-red-400";
  const timerBg = remaining > 300 ? "bg-emerald-500/10" : remaining > 60 ? "bg-amber-500/10" : "bg-red-500/10";

  // Live price vs strike
  const strike = Number(market.strikePrice) / 1e8;
  const currentAbove = livePrice ? livePrice.price > strike : null;

  // User balances
  const upBalance = userBalances ? (userBalances as [bigint, bigint])[0] : 0n;
  const downBalance = userBalances ? (userBalances as [bigint, bigint])[1] : 0n;
  const hasWinnings =
    market.resolved &&
    ((market.outcomeIsUp && upBalance > 0n) || (!market.outcomeIsUp && downBalance > 0n));

  const isActive = !market.resolved && remaining > 0;
  const isLoading = buyLoading || gaslessBuyLoading;

  async function handleBuy(isUp: boolean) {
    if (!amount || parseFloat(amount) <= 0) {
      toast.error("Enter an amount");
      return;
    }
    try {
      if (useGasless && embeddedWallet) {
        await gaslessBuy(market.marketId, isUp, amount);
      } else {
        await buy(market.marketId, isUp, amount);
        toast.success(`${isUp ? "UP" : "DOWN"} trade submitted!`);
      }
    } catch (err: any) {
      toast.error(err?.message?.slice(0, 200) || "Trade failed");
    }
  }

  async function handleClaim() {
    try {
      if (useGasless && embeddedWallet) {
        await gaslessClaim(market.marketId);
      } else {
        await claim(market.marketId);
        toast.success("Claimed!");
      }
    } catch (err: any) {
      toast.error(err?.message?.slice(0, 200) || "Claim failed");
    }
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 hover:border-zinc-700 transition-all">
      {/* Header: asset + timer */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-white">{market.asset}</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-medium">
            Speed
          </span>
        </div>
        {market.resolved ? (
          <span className={cn(
            "text-sm font-bold px-3 py-1 rounded-full",
            market.outcomeIsUp
              ? "bg-emerald-500/10 text-emerald-400"
              : "bg-red-500/10 text-red-400",
          )}>
            {market.outcomeIsUp ? "UP" : "DOWN"}
          </span>
        ) : (
          <span className={cn("text-lg font-mono font-bold px-3 py-1 rounded-lg", timerColor, timerBg)}>
            {formatCountdown(remaining)}
          </span>
        )}
      </div>

      {/* Strike price + live price */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-zinc-800/50 rounded-lg p-3">
          <div className="text-xs text-zinc-500 mb-1">Strike Price</div>
          <div className="text-sm font-semibold text-white">${formatStrikePrice(market.strikePrice)}</div>
        </div>
        <div className="bg-zinc-800/50 rounded-lg p-3">
          <div className="text-xs text-zinc-500 mb-1">Live Price</div>
          {livePrice ? (
            <div className={cn(
              "text-sm font-semibold",
              currentAbove === null ? "text-white" : currentAbove ? "text-emerald-400" : "text-red-400",
            )}>
              ${livePrice.price >= 1000
                ? livePrice.price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                : livePrice.price.toFixed(4)}
            </div>
          ) : (
            <div className="text-sm text-zinc-600">Loading...</div>
          )}
        </div>
      </div>

      {/* Probability bar */}
      <div className="mb-4">
        <div className="flex justify-between text-xs mb-1.5">
          <span className="text-emerald-400 font-medium">UP {upPercent.toFixed(1)}%</span>
          <span className="text-red-400 font-medium">DOWN {downPercent.toFixed(1)}%</span>
        </div>
        <div className="h-2 rounded-full bg-zinc-800 overflow-hidden flex">
          <div className="bg-emerald-500 transition-all duration-500" style={{ width: `${upPercent}%` }} />
          <div className="bg-red-500 transition-all duration-500" style={{ width: `${downPercent}%` }} />
        </div>
      </div>

      {/* Trading section (active markets only) */}
      {isActive && (
        <>
          {/* Amount input + quick buttons */}
          <div className="mb-3">
            <div className="flex gap-1.5 mb-2">
              {QUICK_AMOUNTS.map((qa) => (
                <button
                  key={qa}
                  onClick={() => setAmount(qa)}
                  className={cn(
                    "flex-1 py-1 text-xs rounded-md font-medium transition-colors",
                    amount === qa
                      ? "bg-indigo-600 text-white"
                      : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700",
                  )}
                >
                  ${qa}
                </button>
              ))}
            </div>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Amount (USDT)"
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Gasless toggle */}
          {embeddedWallet && (
            <label className="flex items-center gap-2 mb-3 cursor-pointer">
              <input
                type="checkbox"
                checked={useGasless}
                onChange={(e) => setUseGasless(e.target.checked)}
                className="rounded border-zinc-600 bg-zinc-800 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-xs text-zinc-400">Gasless (embedded wallet)</span>
            </label>
          )}

          {/* UP / DOWN buttons */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => handleBuy(true)}
              disabled={isLoading}
              className="py-3 rounded-lg font-bold text-sm bg-emerald-600 hover:bg-emerald-500 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? "..." : "UP"}
            </button>
            <button
              onClick={() => handleBuy(false)}
              disabled={isLoading}
              className="py-3 rounded-lg font-bold text-sm bg-red-600 hover:bg-red-500 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? "..." : "DOWN"}
            </button>
          </div>
        </>
      )}

      {/* Resolved: claim section */}
      {market.resolved && hasWinnings && (
        <button
          onClick={handleClaim}
          disabled={claimLoading || gaslessClaimLoading}
          className="w-full mt-3 py-3 rounded-lg font-bold text-sm bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-50"
        >
          {claimLoading || gaslessClaimLoading ? "Claiming..." : "Claim Winnings"}
        </button>
      )}

      {/* User position */}
      {address && (upBalance > 0n || downBalance > 0n) && (
        <div className="mt-3 pt-3 border-t border-zinc-800/50 flex justify-between text-xs text-zinc-500">
          <span>UP: {formatUSDT(upBalance)}</span>
          <span>DOWN: {formatUSDT(downBalance)}</span>
        </div>
      )}

      {/* Stats */}
      <div className="flex items-center justify-between text-xs text-zinc-600 mt-3 pt-3 border-t border-zinc-800/50">
        <span>Liquidity: ${formatUSDT(market.totalCollateral)}</span>
        <span>#{market.marketId.toString()}</span>
      </div>
    </div>
  );
}
