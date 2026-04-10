"use client";

import type { MarketData } from "@/hooks/useMarkets";
import { formatUSDT, timeRemaining, shortenAddress, cn } from "@/lib/utils";

export function MarketInfo({ market }: { market: MarketData }) {
  const totalReserve = market.yesReserve + market.noReserve;
  const yesPercent =
    totalReserve > 0n
      ? Number((market.noReserve * 10000n) / totalReserve) / 100
      : 50;
  const noPercent = 100 - yesPercent;
  const isEnded = Number(market.endTimestamp) * 1000 < Date.now();

  return (
    <div className="space-y-6">
      {/* Question + status */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            {market.category}
          </span>
          {market.resolved ? (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-zinc-700/50 text-zinc-300">
              {market.outcomeYes ? "Resolved YES" : "Resolved NO"}
            </span>
          ) : (
            <span
              className={cn(
                "text-xs px-2 py-0.5 rounded-full",
                isEnded ? "bg-red-500/10 text-red-400" : "bg-emerald-500/10 text-emerald-400",
              )}
            >
              {isEnded ? "Ended — awaiting resolution" : timeRemaining(Number(market.endTimestamp))}
            </span>
          )}
        </div>
        <h1 className="text-2xl font-bold text-white">{market.question}</h1>
      </div>

      {/* Large probability display */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
        <div className="flex items-end justify-between mb-4">
          <div>
            <p className="text-xs text-zinc-500 mb-1">YES Probability</p>
            <p className="text-4xl font-bold text-emerald-400">{yesPercent.toFixed(1)}%</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-zinc-500 mb-1">NO Probability</p>
            <p className="text-4xl font-bold text-red-400">{noPercent.toFixed(1)}%</p>
          </div>
        </div>
        <div className="h-3 rounded-full bg-zinc-800 overflow-hidden flex">
          <div className="bg-emerald-500 transition-all duration-500" style={{ width: `${yesPercent}%` }} />
          <div className="bg-red-500 transition-all duration-500" style={{ width: `${noPercent}%` }} />
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Volume", value: `$${formatUSDT(market.totalVolume)}` },
          { label: "Liquidity", value: `$${formatUSDT(market.totalCollateral)}` },
          {
            label: "End Date",
            value: new Date(Number(market.endTimestamp) * 1000).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            }),
          },
          { label: "Contract", value: shortenAddress(market.address) },
        ].map((stat) => (
          <div key={stat.label} className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-3">
            <p className="text-xs text-zinc-500 mb-0.5">{stat.label}</p>
            <p className="text-sm font-semibold text-zinc-200">{stat.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
