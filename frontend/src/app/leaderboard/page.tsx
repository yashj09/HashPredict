"use client";

import { useState } from "react";
import { useLeaderboard } from "@/hooks/useLeaderboard";
import { formatUSDT, shortenAddress, cn } from "@/lib/utils";

type RankBy = "volume" | "pnl";

export default function LeaderboardPage() {
  const { data: entries, isLoading } = useLeaderboard();
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
                ? "bg-indigo-600 text-white"
                : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
            )}
          >
            Volume
          </button>
          <button
            onClick={() => setRankBy("pnl")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
              rankBy === "pnl"
                ? "bg-indigo-600 text-white"
                : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
            )}
          >
            Profit
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className="h-14 bg-zinc-800 rounded-xl animate-pulse"
            />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-zinc-400">No trading activity yet.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-zinc-500 text-xs uppercase border-b border-zinc-800">
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
                    className="text-zinc-300 hover:bg-zinc-800/30 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <span
                        className={cn(
                          "font-bold",
                          i === 0 && "text-amber-400",
                          i === 1 && "text-zinc-300",
                          i === 2 && "text-amber-600",
                          i > 2 && "text-zinc-500"
                        )}
                      >
                        #{i + 1}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-xs">
                      {shortenAddress(entry.address)}
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
                    <td className="py-3 px-4 text-right text-zinc-500">
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
