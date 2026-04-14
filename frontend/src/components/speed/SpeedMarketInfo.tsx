"use client";

import { useState, useEffect } from "react";
import type { SpeedMarketData } from "@/hooks/useSpeedMarkets";
import { usePythPrice } from "@/hooks/usePythPrice";
import { formatUSDT, shortenAddress, cn, explorerAddressUrl } from "@/lib/utils";
import { SPEED_MARKET_ADDRESS } from "@/lib/contracts";

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
  if (seconds <= 0) return "Expired";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function formatStrikePrice(strikePrice: bigint): string {
  const price = Number(strikePrice) / 1e8;
  if (price >= 1000) return price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}

export function SpeedMarketInfo({ market }: { market: SpeedMarketData }) {
  const remaining = useCountdown(market.expiry);
  const { data: livePrice } = usePythPrice(market.asset);

  const totalReserve = market.reserveUp + market.reserveDown;
  const upPercent = totalReserve > 0n
    ? Number((market.reserveDown * 10000n) / totalReserve) / 100
    : 50;
  const downPercent = 100 - upPercent;

  const strike = Number(market.strikePrice) / 1e8;
  const currentAbove = livePrice ? livePrice.price > strike : null;

  const timerColor = remaining > 300 ? "text-emerald-400" : remaining > 60 ? "text-amber-400" : "text-red-400";
  const timerBg = remaining > 300 ? "bg-emerald-500/10" : remaining > 60 ? "bg-amber-500/10" : "bg-red-500/10";

  return (
    <div className="space-y-6">
      {/* Header: asset + status */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
            Speed Market
          </span>
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            {market.asset}
          </span>
          {market.resolved ? (
            <span className={cn(
              "text-xs font-medium px-2 py-0.5 rounded-full",
              market.outcomeIsUp
                ? "bg-emerald-500/10 text-emerald-400"
                : "bg-red-500/10 text-red-400",
            )}>
              Resolved {market.outcomeIsUp ? "UP" : "DOWN"}
            </span>
          ) : remaining <= 0 ? (
            <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/10 text-red-400">
              Awaiting resolution
            </span>
          ) : (
            <span className={cn("text-xs font-mono font-bold px-2 py-0.5 rounded-full", timerColor, timerBg)}>
              {formatCountdown(remaining)}
            </span>
          )}
        </div>
        <h1 className="text-2xl font-bold text-white">
          Will {market.asset} price go UP or DOWN?
        </h1>
        <p className="text-sm text-zinc-400 mt-1">
          Strike: ${formatStrikePrice(market.strikePrice)} — 15 minute speed market
        </p>
      </div>

      {/* Large probability display */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
        <div className="flex items-end justify-between mb-4">
          <div>
            <p className="text-xs text-zinc-500 mb-1">UP Probability</p>
            <p className="text-4xl font-bold text-emerald-400">{upPercent.toFixed(1)}%</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-zinc-500 mb-1">DOWN Probability</p>
            <p className="text-4xl font-bold text-red-400">{downPercent.toFixed(1)}%</p>
          </div>
        </div>
        <div className="h-3 rounded-full bg-zinc-800 overflow-hidden flex">
          <div className="bg-emerald-500 transition-all duration-500" style={{ width: `${upPercent}%` }} />
          <div className="bg-red-500 transition-all duration-500" style={{ width: `${downPercent}%` }} />
        </div>
      </div>

      {/* Price comparison + stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-3">
          <p className="text-xs text-zinc-500 mb-0.5">Strike Price</p>
          <p className="text-sm font-semibold text-zinc-200">${formatStrikePrice(market.strikePrice)}</p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-3">
          <p className="text-xs text-zinc-500 mb-0.5">Live Price</p>
          {livePrice ? (
            <p className={cn(
              "text-sm font-semibold",
              currentAbove === null ? "text-zinc-200" : currentAbove ? "text-emerald-400" : "text-red-400",
            )}>
              ${livePrice.price >= 1000
                ? livePrice.price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                : livePrice.price.toFixed(4)}
            </p>
          ) : (
            <p className="text-sm text-zinc-600">Loading...</p>
          )}
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-3">
          <p className="text-xs text-zinc-500 mb-0.5">Liquidity</p>
          <p className="text-sm font-semibold text-zinc-200">${formatUSDT(market.totalCollateral)}</p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-3">
          <p className="text-xs text-zinc-500 mb-0.5">Contract</p>
          <a
            href={explorerAddressUrl(SPEED_MARKET_ADDRESS)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-semibold text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            {shortenAddress(SPEED_MARKET_ADDRESS)}
          </a>
        </div>
      </div>
    </div>
  );
}
