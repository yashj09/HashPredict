"use client";

import { useState } from "react";
import { useLeaderboard } from "@/hooks/useLeaderboard";
import { formatUSDT, shortenAddress, cn, explorerAddressUrl } from "@/lib/utils";

type RankBy = "volume" | "pnl";

export default function LeaderboardPage() {
  const { data: entries, isLoading, isError } = useLeaderboard();
  const [rankBy, setRankBy] = useState<RankBy>("volume");

  const sorted = [...(entries ?? [])].sort((a, b) => {
    if (rankBy === "volume") return Number(b.totalVolume - a.totalVolume);
    return Number(b.realizedPnL - a.realizedPnL);
  });

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Leaderboard</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setRankBy("volume")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
              rankBy === "volume"
                ? "btn-gradient-primary text-white"
                : "glass-panel text-slate-400"
            )}
          >
            Volume
          </button>
          <button
            onClick={() => setRankBy("pnl")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
              rankBy === "pnl"
                ? "btn-gradient-primary text-white"
                : "glass-panel text-slate-400"
            )}
          >
            Profit
          </button>
        </div>
      </div>

      {isError ? (
        <div className="text-center py-12">
          <p className="text-slate-400">Failed to load leaderboard data.</p>
        </div>
      ) : isLoading ? (
        <div className="space-y-3">
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className="h-14 bg-slate-800 rounded-xl animate-pulse"
            />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-slate-400">No trading activity yet.</p>
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-500 text-xs uppercase border-b border-slate-800">
                <th className="text-left py-3 px-4 font-medium w-12">Rank</th>
                <th className="text-left py-3 px-4 font-medium">Trader</th>
                <th className="text-right py-3 px-4 font-medium">Volume</th>
                <th className="text-right py-3 px-4 font-medium">P&L</th>
                <th className="text-right py-3 px-4 font-medium">Trades</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {sorted.map((entry, i) => {
                const isPositive = entry.realizedPnL >= 0n;
                return (
                  <tr
                    key={entry.address}
                    className="text-slate-300 hover:bg-slate-800/30 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <span
                        className={cn(
                          "font-bold",
                          i === 0 && "text-amber-400",
                          i === 1 && "text-slate-300",
                          i === 2 && "text-amber-600",
                          i > 2 && "text-slate-500"
                        )}
                      >
                        #{i + 1}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-xs">
                      <a
                        href={explorerAddressUrl(entry.address)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-teal-400 transition-colors"
                      >
                        {shortenAddress(entry.address)}
                      </a>
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-xs">
                      ${formatUSDT(entry.totalVolume)}
                    </td>
                    <td
                      className={cn(
                        "py-3 px-4 text-right font-mono text-xs font-medium",
                        isPositive ? "text-emerald-400" : "text-red-400"
                      )}
                    >
                      {isPositive ? "+" : "-"}$
                      {formatUSDT(
                        isPositive
                          ? entry.realizedPnL
                          : -entry.realizedPnL
                      )}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-500">
                      {entry.tradeCount}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
