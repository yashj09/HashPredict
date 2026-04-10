"use client";

import Link from "next/link";
import type { MarketData } from "@/hooks/useMarkets";
import { formatUSDT, formatProbabilityNumber, timeRemaining, cn } from "@/lib/utils";

const categoryColors: Record<string, string> = {
  Crypto: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  RWA: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  Ecosystem: "bg-purple-500/10 text-purple-400 border-purple-500/20",
};

export function MarketCard({ market }: { market: MarketData }) {
  const totalReserve = market.yesReserve + market.noReserve;
  const yesPercent =
    totalReserve > 0n
      ? Number((market.noReserve * 10000n) / totalReserve) / 100
      : 50;
  const noPercent = 100 - yesPercent;

  const isEnded = Number(market.endTimestamp) * 1000 < Date.now();
  const colorClass = categoryColors[market.category] ?? "bg-zinc-500/10 text-zinc-400 border-zinc-500/20";

  return (
    <Link href={`/market/${market.address}`}>
      <div className="group rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 hover:border-zinc-700 hover:bg-zinc-900 transition-all cursor-pointer h-full flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full border", colorClass)}>
            {market.category}
          </span>
          {market.resolved ? (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-zinc-700/50 text-zinc-300">
              {market.outcomeYes ? "Resolved YES" : "Resolved NO"}
            </span>
          ) : (
            <span className={cn(
              "text-xs px-2 py-0.5 rounded-full",
              isEnded
                ? "bg-red-500/10 text-red-400"
                : "bg-emerald-500/10 text-emerald-400"
            )}>
              {isEnded ? "Ended" : timeRemaining(Number(market.endTimestamp))}
            </span>
          )}
        </div>

        {/* Question */}
        <h3 className="text-sm font-semibold text-zinc-100 mb-4 leading-snug line-clamp-2 flex-1">
          {market.question}
        </h3>

        {/* Probability bar */}
        <div className="mb-3">
          <div className="flex justify-between text-xs mb-1.5">
            <span className="text-emerald-400 font-medium">Yes {yesPercent.toFixed(1)}%</span>
            <span className="text-red-400 font-medium">No {noPercent.toFixed(1)}%</span>
          </div>
          <div className="h-2 rounded-full bg-zinc-800 overflow-hidden flex">
            <div
              className="bg-emerald-500 transition-all duration-500"
              style={{ width: `${yesPercent}%` }}
            />
            <div
              className="bg-red-500 transition-all duration-500"
              style={{ width: `${noPercent}%` }}
            />
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center justify-between text-xs text-zinc-500 pt-3 border-t border-zinc-800/50">
          <span>Vol: ${formatUSDT(market.totalVolume)}</span>
          <span>Liquidity: ${formatUSDT(market.totalCollateral)}</span>
        </div>
      </div>
    </Link>
  );
}
