"use client";

import { useState } from "react";
import { useLeaderboard } from "@/hooks/useLeaderboard";
import { formatUSDT, shortenAddress, cn, explorerAddressUrl } from "@/lib/utils";

type RankBy = "volume" | "pnl" | "trades";

const RANK_OPTIONS: { key: RankBy; label: string }[] = [
  { key: "volume", label: "Volume" },
  { key: "pnl", label: "Profit" },
  { key: "trades", label: "Trades" },
];

function MedalIcon({ rank }: { rank: number }) {
  if (rank === 0) return <span className="text-lg">&#x1F947;</span>;
  if (rank === 1) return <span className="text-lg">&#x1F948;</span>;
  if (rank === 2) return <span className="text-lg">&#x1F949;</span>;
  return (
    <span className="text-slate-500 font-mono text-xs">#{rank + 1}</span>
  );
}

export default function LeaderboardPage() {
  const { data: entries, isLoading, isError, dataUpdatedAt } = useLeaderboard();
  const [rankBy, setRankBy] = useState<RankBy>("volume");

  const sorted = [...(entries ?? [])].sort((a, b) => {
    switch (rankBy) {
      case "volume": return Number(b.totalVolume - a.totalVolume);
      case "pnl": return Number(b.realizedPnL - a.realizedPnL);
      case "trades": return b.tradeCount - a.tradeCount;
    }
  });

  const totalVolume = sorted.reduce((acc, e) => acc + e.totalVolume, 0n);
  const totalTrades = sorted.reduce((acc, e) => acc + e.tradeCount, 0);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">Leaderboard</h1>
          <p className="text-sm text-slate-500 mt-1">
            On-chain rankings from all prediction &amp; speed markets
          </p>
        </div>
        <div className="flex items-center gap-2">
          {RANK_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setRankBy(opt.key)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                rankBy === opt.key
                  ? "bg-teal-600 text-white"
                  : "bg-slate-800/40 border border-slate-700/30 text-slate-400 hover:text-slate-200",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Stats summary */}
      {!isLoading && sorted.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="glass-panel p-3 text-center">
            <p className="text-xs text-slate-500 mb-0.5">Total Traders</p>
            <p className="text-lg font-bold text-white">{sorted.length}</p>
          </div>
          <div className="glass-panel p-3 text-center">
            <p className="text-xs text-slate-500 mb-0.5">Total Volume</p>
            <p className="text-lg font-bold text-white">${formatUSDT(totalVolume)}</p>
          </div>
          <div className="glass-panel p-3 text-center">
            <p className="text-xs text-slate-500 mb-0.5">Total Trades</p>
            <p className="text-lg font-bold text-white">{totalTrades}</p>
          </div>
        </div>
      )}

      {/* Table */}
      {isError ? (
        <div className="text-center py-12">
          <p className="text-slate-400">Failed to load leaderboard data.</p>
        </div>
      ) : isLoading ? (
        <div className="space-y-3">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="skeleton h-14" />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-slate-400">No trading activity yet. Be the first to trade!</p>
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-500 text-xs uppercase border-b border-[var(--glass-border)]">
                  <th className="text-left py-3 px-4 font-medium w-16">Rank</th>
                  <th className="text-left py-3 px-4 font-medium">Trader</th>
                  <th className="text-right py-3 px-4 font-medium">Volume</th>
                  <th className="text-right py-3 px-4 font-medium">P&amp;L</th>
                  <th className="text-right py-3 px-4 font-medium">Trades</th>
                  <th className="text-right py-3 px-4 font-medium">Breakdown</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/30">
                {sorted.map((entry, i) => {
                  const isPositive = entry.realizedPnL >= 0n;
                  const isTop3 = i < 3;
                  return (
                    <tr
                      key={entry.address}
                      className={cn(
                        "text-slate-300 transition-colors",
                        isTop3
                          ? "hover:bg-teal-500/5"
                          : "hover:bg-slate-800/20",
                      )}
                    >
                      <td className="py-3.5 px-4">
                        <MedalIcon rank={i} />
                      </td>
                      <td className="py-3.5 px-4 font-mono text-xs">
                        <a
                          href={explorerAddressUrl(entry.address)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-teal-400 transition-colors"
                        >
                          {shortenAddress(entry.address)}
                        </a>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-xs font-medium text-white">
                        ${formatUSDT(entry.totalVolume)}
                      </td>
                      <td
                        className={cn(
                          "py-3.5 px-4 text-right font-mono text-xs font-medium",
                          isPositive ? "text-emerald-400" : "text-red-400",
                        )}
                      >
                        {isPositive ? "+" : "-"}$
                        {formatUSDT(
                          isPositive ? entry.realizedPnL : -entry.realizedPnL,
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right text-slate-400 font-mono text-xs">
                        {entry.tradeCount}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {entry.regularTrades > 0 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-teal-500/10 text-teal-400 border border-teal-500/20">
                              {entry.regularTrades} Pred
                            </span>
                          )}
                          {entry.speedTrades > 0 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                              {entry.speedTrades} Speed
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="px-4 py-2.5 border-t border-[var(--glass-border)] flex items-center justify-between text-[10px] text-slate-600">
            <span>Data sourced from on-chain events</span>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Auto-refreshes every 30s
              {dataUpdatedAt > 0 && (
                <span className="ml-1">
                  &middot; Updated {new Date(dataUpdatedAt).toLocaleTimeString()}
                </span>
              )}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
