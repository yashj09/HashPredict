"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import type { SpeedMarketData } from "@/hooks/useSpeedMarkets";
import { useSpeedUserBalances } from "@/hooks/useSpeedTrade";
import { usePythPrice } from "@/hooks/usePythPrice";
import { cn, formatUSDT } from "@/lib/utils";

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

export function SpeedMarketCard({ market }: { market: SpeedMarketData }) {
  const { address } = useAccount();
  const remaining = useCountdown(market.expiry);
  const { data: livePrice } = usePythPrice(market.asset);
  const { data: userBalances } = useSpeedUserBalances(market.marketId);

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

  return (
    <Link href={`/speed/${market.marketId.toString()}`}>
      <div className="group glass-card p-5 cursor-pointer h-full flex flex-col">
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
          <div className="glass-panel p-3">
            <div className="text-xs text-slate-500 mb-1">Strike Price</div>
            <div className="text-sm font-semibold text-white">${formatStrikePrice(market.strikePrice)}</div>
          </div>
          <div className="glass-panel p-3">
            <div className="text-xs text-slate-500 mb-1">Live Price</div>
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
              <div className="text-sm text-slate-600">Loading...</div>
            )}
          </div>
        </div>

        {/* Probability bar */}
        <div className="mb-4 flex-1">
          <div className="flex justify-between text-xs mb-1.5">
            <span className="text-emerald-400 font-medium">UP {upPercent.toFixed(1)}%</span>
            <span className="text-red-400 font-medium">DOWN {downPercent.toFixed(1)}%</span>
          </div>
          <div className="h-2 rounded-full prob-bar-track flex">
            <div className="bg-emerald-500 transition-all duration-500" style={{ width: `${upPercent}%` }} />
            <div className="bg-red-500 transition-all duration-500" style={{ width: `${downPercent}%` }} />
          </div>
        </div>

        {/* User position */}
        {address && (upBalance > 0n || downBalance > 0n) && (
          <div className="mb-3 pt-3 border-t border-[var(--glass-border)] flex justify-between text-xs text-slate-500">
            <span>UP: {formatUSDT(upBalance)}</span>
            <span>DOWN: {formatUSDT(downBalance)}</span>
          </div>
        )}

        {/* Stats */}
        <div className="flex items-center justify-between text-xs text-slate-600 pt-3 border-t border-[var(--glass-border)]">
          <span>Liquidity: ${formatUSDT(market.totalCollateral)}</span>
          <span>#{market.marketId.toString()}</span>
        </div>
      </div>
    </Link>
  );
}
